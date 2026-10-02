use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, RecvTimeoutError, TryRecvError};
use std::sync::Arc;
use std::time::{Duration, Instant};

pub(super) const CHANNEL_CAPACITY: usize = 64;
const MAX_LATENCY: Duration = Duration::from_millis(200);

pub(super) fn process_events(
    events: Receiver<()>,
    stop: Receiver<()>,
    overflow: Arc<AtomicBool>,
    mut emit: impl FnMut(),
) {
    let mut dirty = false;
    let mut last_flush = Instant::now();
    loop {
        match stop.try_recv() {
            Ok(()) | Err(TryRecvError::Disconnected) => break,
            Err(TryRecvError::Empty) => {}
        }
        let remaining = MAX_LATENCY.saturating_sub(last_flush.elapsed());
        match events.recv_timeout(remaining) {
            Ok(()) => dirty = true,
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => break,
        }
        dirty |= overflow.swap(false, Ordering::AcqRel);
        if last_flush.elapsed() >= MAX_LATENCY {
            if dirty {
                emit();
            }
            dirty = false;
            last_flush = Instant::now();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    #[test]
    fn sustained_events_flush_before_the_producer_finishes() {
        let (tx, rx) = mpsc::sync_channel(CHANNEL_CAPACITY);
        let (stop_tx, stop_rx) = mpsc::channel();
        let (emitted_tx, emitted_rx) = mpsc::channel();
        let overflow = Arc::new(AtomicBool::new(false));
        let worker_overflow = Arc::clone(&overflow);
        let worker = std::thread::spawn(move || {
            process_events(rx, stop_rx, worker_overflow, || {
                emitted_tx.send(()).unwrap();
            });
        });
        let producer = std::thread::spawn(move || {
            let start = Instant::now();
            while start.elapsed() < Duration::from_millis(700) {
                if tx.try_send(()).is_err() {
                    overflow.store(true, Ordering::Release);
                }
                std::thread::sleep(Duration::from_millis(1));
            }
            tx
        });
        emitted_rx.recv_timeout(Duration::from_millis(600)).unwrap();
        assert!(!producer.is_finished());
        emitted_rx.recv_timeout(Duration::from_millis(600)).unwrap();
        stop_tx.send(()).unwrap();
        worker.join().unwrap();
        producer.join().unwrap();
    }

    #[test]
    fn full_queue_coalesces_and_overflow_still_invalidates() {
        let (tx, rx) = mpsc::sync_channel(CHANNEL_CAPACITY);
        for _ in 0..CHANNEL_CAPACITY {
            tx.try_send(()).unwrap();
        }
        assert!(tx.try_send(()).is_err());
        let (stop_tx, stop_rx) = mpsc::channel();
        let (emitted_tx, emitted_rx) = mpsc::channel();
        let worker = std::thread::spawn(move || {
            process_events(rx, stop_rx, Arc::new(AtomicBool::new(true)), || {
                emitted_tx.send(()).unwrap();
            });
        });
        emitted_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        assert!(emitted_rx.try_recv().is_err());
        stop_tx.send(()).unwrap();
        worker.join().unwrap();
    }

    #[test]
    fn stopping_discards_pending_old_project_events() {
        let (tx, rx) = mpsc::sync_channel(CHANNEL_CAPACITY);
        let (stop_tx, stop_rx) = mpsc::channel();
        tx.send(()).unwrap();
        stop_tx.send(()).unwrap();
        let mut emitted = false;
        process_events(rx, stop_rx, Arc::new(AtomicBool::new(true)), || {
            emitted = true;
        });
        assert!(!emitted);
    }
}
