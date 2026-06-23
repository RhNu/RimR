//! User-managed ordered list of active mod package ids.

use crate::domain::PackageId;
use indexmap::IndexMap;

/// A user-managed ordered set of active mod package ids.
///
/// The order is authoritative (user-controlled). Position lookups are O(1)
/// via an internal reverse index that is rebuilt on every mutation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActiveModList {
    order: Vec<PackageId>,
    index: IndexMap<PackageId, usize>,
}

impl ActiveModList {
    /// Creates an empty list.
    pub fn empty() -> Self {
        Self {
            order: Vec::new(),
            index: IndexMap::new(),
        }
    }

    /// Creates a list from an ordered slice of package ids.
    /// Duplicate ids in the input are ignored after their first occurrence.
    pub fn from_slice(ids: &[PackageId]) -> Self {
        let mut list = Self::empty();
        for id in ids {
            list.append(id.clone());
        }
        list
    }

    /// Appends a package id to the end. No-op if already present.
    pub fn append(&mut self, id: PackageId) {
        if self.index.contains_key(&id) {
            return;
        }
        let pos = self.order.len();
        self.order.push(id.clone());
        self.index.insert(id, pos);
    }

    /// Inserts a package id at a specific position. No-op if already present.
    /// Clamps position to [0, len].
    pub fn insert(&mut self, id: PackageId, pos: usize) {
        if self.index.contains_key(&id) {
            return;
        }
        let pos = pos.min(self.order.len());
        self.order.insert(pos, id);
        self.rebuild_index();
    }

    /// Removes a package id. Returns true if it was present.
    pub fn remove(&mut self, id: &PackageId) -> bool {
        if self.index.swap_remove(id).is_none() {
            return false;
        }
        self.order.retain(|x| x != id);
        self.rebuild_index();
        true
    }

    /// Moves a package id to an absolute position. No-op if not found.
    /// Clamps position to [0, len-1].
    pub fn move_to(&mut self, id: &PackageId, new_pos: usize) {
        let Some(&old_pos) = self.index.get(id) else {
            return;
        };
        let new_pos = new_pos.min(self.order.len() - 1);
        if old_pos == new_pos {
            return;
        }
        let id = self.order.remove(old_pos);
        self.order.insert(new_pos, id);
        self.rebuild_index();
    }

    /// Moves a package id to immediately before another. No-op if either
    /// is missing or they are already at the same position.
    pub fn move_before(&mut self, id: &PackageId, target: &PackageId) {
        let Some(&old_pos) = self.index.get(id) else {
            return;
        };
        let Some(&target_pos) = self.index.get(target) else {
            return;
        };
        if old_pos == target_pos {
            return;
        }
        let id_owned = self.order.remove(old_pos);
        // After removal, target_pos may shift if old_pos < target_pos.
        let new_target_pos = if old_pos < target_pos {
            target_pos - 1
        } else {
            target_pos
        };
        self.order.insert(new_target_pos, id_owned);
        self.rebuild_index();
    }

    /// Moves a package id to immediately after another.
    pub fn move_after(&mut self, id: &PackageId, target: &PackageId) {
        let Some(&old_pos) = self.index.get(id) else {
            return;
        };
        let Some(&target_pos) = self.index.get(target) else {
            return;
        };
        if old_pos == target_pos {
            return;
        }
        let id_owned = self.order.remove(old_pos);
        let new_pos = if old_pos < target_pos {
            target_pos
        } else {
            target_pos + 1
        };
        self.order.insert(new_pos, id_owned);
        self.rebuild_index();
    }

    /// Returns the position of a package id, or None.
    pub fn position(&self, id: &PackageId) -> Option<usize> {
        self.index.get(id).copied()
    }

    pub fn contains(&self, id: &PackageId) -> bool {
        self.index.contains_key(id)
    }

    pub fn len(&self) -> usize {
        self.order.len()
    }

    pub fn is_empty(&self) -> bool {
        self.order.is_empty()
    }

    pub fn iter(&self) -> impl Iterator<Item = &PackageId> {
        self.order.iter()
    }

    pub fn as_slice(&self) -> &[PackageId] {
        &self.order
    }

    /// Returns a vector of package ids in order.
    pub fn to_vec(&self) -> Vec<PackageId> {
        self.order.clone()
    }

    /// Replaces the entire order. Duplicate ids are ignored after their first occurrence.
    pub fn replace_all(&mut self, ids: Vec<PackageId>) {
        self.order.clear();
        self.index.clear();
        for id in ids {
            self.append(id);
        }
    }

    fn rebuild_index(&mut self) {
        self.index = IndexMap::with_capacity(self.order.len());
        for (i, id) in self.order.iter().enumerate() {
            self.index.insert(id.clone(), i);
        }
    }
}

impl Default for ActiveModList {
    fn default() -> Self {
        Self::empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_order(list: &ActiveModList, expected: &[&PackageId]) {
        let actual: Vec<&str> = list.iter().map(PackageId::as_str).collect();
        let want: Vec<&str> = expected.iter().map(|p| p.as_str()).collect();
        assert_eq!(actual, want);
    }

    #[test]
    fn from_slice_assigns_positions() {
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let list = ActiveModList::from_slice(&[a.clone(), b.clone(), c.clone()]);
        assert_eq!(list.position(&a), Some(0));
        assert_eq!(list.position(&b), Some(1));
        assert_eq!(list.position(&c), Some(2));
    }

    #[test]
    fn move_to_reorders() {
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let mut list = ActiveModList::from_slice(&[a.clone(), b.clone(), c.clone()]);
        list.move_to(&c, 0);
        assert_order(&list, &[&c, &a, &b]);
    }

    #[test]
    fn move_before_reorders() {
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let mut list = ActiveModList::from_slice(&[a.clone(), b.clone(), c.clone()]);
        list.move_before(&c, &a);
        assert_order(&list, &[&c, &a, &b]);
    }

    #[test]
    fn move_after_reorders() {
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let mut list = ActiveModList::from_slice(&[a.clone(), b.clone(), c.clone()]);
        list.move_after(&a, &c);
        // a is moved to immediately after c: [a,b,c] -> [b,c,a]
        assert_order(&list, &[&b, &c, &a]);
    }

    #[test]
    fn insert_at_position() {
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let d = PackageId::new("d");
        let mut list = ActiveModList::from_slice(&[a.clone(), b.clone(), c.clone()]);
        list.insert(d.clone(), 1);
        assert_order(&list, &[&a, &d, &b, &c]);
    }

    #[test]
    fn remove_updates_order_and_index() {
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let mut list = ActiveModList::from_slice(&[a.clone(), b.clone(), c.clone()]);
        assert!(list.remove(&b));
        assert_eq!(list.position(&a), Some(0));
        assert_eq!(list.position(&c), Some(1));
        assert_eq!(list.position(&b), None);
        assert_order(&list, &[&a, &c]);
    }

    #[test]
    fn append_existing_is_noop() {
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let mut list = ActiveModList::from_slice(&[a.clone(), b.clone(), c.clone()]);
        list.append(a.clone());
        assert_eq!(list.len(), 3);
        assert_order(&list, &[&a, &b, &c]);
    }

    #[test]
    fn insert_existing_is_noop() {
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let mut list = ActiveModList::from_slice(&[a.clone(), b.clone(), c.clone()]);
        list.insert(a.clone(), 0);
        assert_order(&list, &[&a, &b, &c]);
    }

    #[test]
    fn position_unknown_returns_none() {
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let list = ActiveModList::from_slice(&[a, b, c]);
        let z = PackageId::new("z");
        assert_eq!(list.position(&z), None);
    }

    #[test]
    fn empty_and_len() {
        let empty = ActiveModList::empty();
        assert!(empty.is_empty());
        assert_eq!(empty.len(), 0);
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let list = ActiveModList::from_slice(&[a, b, c]);
        assert!(!list.is_empty());
        assert_eq!(list.len(), 3);
    }

    #[test]
    fn replace_all_rebuilds_index() {
        let x = PackageId::new("x");
        let y = PackageId::new("y");
        let z = PackageId::new("z");
        let mut list = ActiveModList::empty();
        list.replace_all(vec![x.clone(), y.clone(), z.clone()]);
        assert_eq!(list.position(&x), Some(0));
        assert_eq!(list.position(&y), Some(1));
        assert_eq!(list.position(&z), Some(2));
        assert_order(&list, &[&x, &y, &z]);
    }

    #[test]
    fn replace_all_deduplicates_like_append() {
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let mut list = ActiveModList::empty();
        list.replace_all(vec![a.clone(), b.clone(), a.clone(), c.clone(), b.clone()]);
        assert_order(&list, &[&a, &b, &c]);
        assert_eq!(list.position(&a), Some(0));
        assert_eq!(list.position(&b), Some(1));
        assert_eq!(list.position(&c), Some(2));
    }

    #[test]
    fn move_to_clamps_to_end() {
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let mut list = ActiveModList::from_slice(&[a.clone(), b.clone(), c.clone()]);
        list.move_to(&a, 100);
        assert_order(&list, &[&b, &c, &a]);
    }

    #[test]
    fn move_before_missing_target_is_noop() {
        let a = PackageId::new("a");
        let b = PackageId::new("b");
        let c = PackageId::new("c");
        let z = PackageId::new("z");
        let mut list = ActiveModList::from_slice(&[a.clone(), b.clone(), c.clone()]);
        list.move_before(&a, &z);
        assert_order(&list, &[&a, &b, &c]);
    }
}
