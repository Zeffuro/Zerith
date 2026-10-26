#[cfg(test)]
mod tests {
    use glib::variant::ToVariant;

    fn value() -> glib::Variant {
        vec!["alpha", "ø", "水", ""].to_variant()
    }

    #[test]
    fn forward_and_reverse_preserve_borrowed_strings() {
        let value = value();
        assert_eq!(
            value.array_iter_str().unwrap().collect::<Vec<_>>(),
            ["alpha", "ø", "水", ""]
        );
        assert_eq!(
            value.array_iter_str().unwrap().rev().collect::<Vec<_>>(),
            ["", "水", "ø", "alpha"]
        );
    }

    #[test]
    fn mixed_ends_and_skips_preserve_length() {
        let value = value();
        let mut iterator = value.array_iter_str().unwrap();
        assert_eq!(iterator.len(), 4);
        assert_eq!(iterator.next(), Some("alpha"));
        assert_eq!(iterator.next_back(), Some(""));
        assert_eq!(iterator.nth(0), Some("ø"));
        assert_eq!(iterator.nth_back(0), Some("水"));
        assert_eq!(iterator.len(), 0);
        assert_eq!(iterator.next(), None);
        assert_eq!(iterator.next_back(), None);
    }

    #[test]
    fn nth_nth_back_and_last_read_the_expected_child() {
        let value = value();
        assert_eq!(value.array_iter_str().unwrap().nth(2), Some("水"));
        assert_eq!(value.array_iter_str().unwrap().nth_back(2), Some("ø"));
        assert_eq!(value.array_iter_str().unwrap().last(), Some(""));
    }

    #[test]
    fn empty_and_out_of_range_iterators_stay_exhausted() {
        let value = Vec::<&str>::new().to_variant();
        let mut iterator = value.array_iter_str().unwrap();
        assert_eq!(iterator.len(), 0);
        assert_eq!(iterator.next(), None);
        assert_eq!(iterator.nth(100), None);
        assert_eq!(iterator.nth_back(100), None);
        assert_eq!(iterator.next_back(), None);
    }
}
