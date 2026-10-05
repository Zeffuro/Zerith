use std::io::{Read, Seek, SeekFrom};

pub fn check_directory<R: Read + Seek>(reader: &mut R, size: u64) -> Result<usize, String> {
    let length = size.min(65_557) as usize;
    reader
        .seek(SeekFrom::End(-(length as i64)))
        .map_err(|e| e.to_string())?;
    let mut tail = vec![0; length];
    reader.read_exact(&mut tail).map_err(|e| e.to_string())?;
    let offset = (0..length.saturating_sub(21))
        .rev()
        .find(|offset| {
            tail[*offset..].starts_with(b"PK\x05\x06")
                && *offset + 22 + usize::from(u16_at(&tail, *offset + 20)) == length
        })
        .ok_or("Game package has no valid ZIP directory")?;
    let directory_end = size - length as u64 + offset as u64;
    if u16_at(&tail, offset + 4) != 0 || u16_at(&tail, offset + 6) != 0 {
        return Err("Multi-disk game packages are unsupported".into());
    }
    let mut count = u64::from(u16_at(&tail, offset + 10));
    let mut bytes = u64::from(u32_at(&tail, offset + 12));
    let mut start = u64::from(u32_at(&tail, offset + 16));
    if count == 65_535 || bytes == u64::from(u32::MAX) || start == u64::from(u32::MAX) {
        if directory_end < 20 {
            return Err("Game package ZIP64 directory is missing".into());
        }
        reader
            .seek(SeekFrom::Start(directory_end - 20))
            .map_err(|e| e.to_string())?;
        let mut locator = [0; 20];
        reader.read_exact(&mut locator).map_err(|e| e.to_string())?;
        if &locator[..4] != b"PK\x06\x07" || u32_at(&locator, 4) != 0 || u32_at(&locator, 16) != 1 {
            return Err("Game package ZIP64 directory is invalid".into());
        }
        let position = u64_at(&locator, 8);
        if position > directory_end - 20 || directory_end - 20 - position < 56 {
            return Err("Game package ZIP64 directory offset is invalid".into());
        }
        reader
            .seek(SeekFrom::Start(position))
            .map_err(|e| e.to_string())?;
        let mut end = [0; 56];
        reader.read_exact(&mut end).map_err(|e| e.to_string())?;
        if &end[..4] != b"PK\x06\x06"
            || !(44..=1024).contains(&u64_at(&end, 4))
            || u32_at(&end, 16) != 0
            || u32_at(&end, 20) != 0
            || u64_at(&end, 24) != u64_at(&end, 32)
        {
            return Err("Game package ZIP64 directory is invalid".into());
        }
        count = u64_at(&end, 32);
        bytes = u64_at(&end, 40);
        start = u64_at(&end, 48);
    } else if u16_at(&tail, offset + 8) != u16_at(&tail, offset + 10) {
        return Err("Game package ZIP directory entry count is invalid".into());
    }
    if count > 100_000
        || bytes > 256 * 1024 * 1024
        || start > directory_end
        || bytes > directory_end - start
    {
        return Err("Game package ZIP directory exceeds the size or entry limit".into());
    }
    reader.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
    Ok(count as usize)
}

fn u16_at(bytes: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes(bytes[offset..offset + 2].try_into().unwrap())
}
fn u32_at(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
}
fn u64_at(bytes: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(bytes[offset..offset + 8].try_into().unwrap())
}
