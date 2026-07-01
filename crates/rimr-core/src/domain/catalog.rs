//! Catalog of installed mods indexed by PackageId.

use crate::domain::{ModMetadata, PackageId};
use crate::ports::ModSourceKey;
use indexmap::IndexMap;
use std::sync::Arc;

/// Result of inserting into a ModCatalog.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CatalogInsertResult {
    /// Inserted as a new entry.
    Inserted,
    /// A mod with the same packageId already existed; the first entry is kept
    /// and the packageId is recorded as a duplicate.
    Duplicate,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DuplicatePackageId {
    pub package_id: PackageId,
    pub source_keys: Vec<ModSourceKey>,
}

/// All installed mods indexed by PackageId.
///
/// Duplicate packageIds are tracked separately; the catalog keeps the first
/// inserted entry and records subsequent ones as duplicates.
#[derive(Debug, Clone, Default)]
pub struct ModCatalog {
    mods: IndexMap<CatalogStorageKey, ModMetadata>,
    by_source_key: IndexMap<ModSourceKey, ModMetadata>,
    duplicates: Vec<PackageId>,
    duplicate_sources: Vec<DuplicatePackageId>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
enum CatalogStorageKey {
    Package(PackageId),
    Source(Arc<str>),
}

impl CatalogStorageKey {
    fn for_metadata(metadata: &ModMetadata) -> Self {
        if metadata.package_id.is_sentinel() {
            Self::Source(Arc::from(metadata.source_key.as_str()))
        } else {
            Self::Package(metadata.package_id.clone())
        }
    }

    fn for_package(package_id: &PackageId) -> Self {
        Self::Package(package_id.clone())
    }
}

impl ModCatalog {
    pub fn new() -> Self {
        Self::default()
    }

    /// Inserts a mod. If the packageId already exists, the existing entry is
    /// kept, the packageId is recorded as a duplicate, and
    /// `CatalogInsertResult::Duplicate` is returned.
    ///
    /// Sentinel package IDs (missing/invalid) are exempt from duplicate
    /// tracking — each missing-packageId mod is an independent error, not a
    /// duplicate of other missing-packageId mods.
    pub fn insert(&mut self, metadata: ModMetadata) -> CatalogInsertResult {
        let id = metadata.package_id.clone();
        let storage_key = CatalogStorageKey::for_metadata(&metadata);
        let source_key = metadata.source_key.clone();
        self.by_source_key
            .insert(source_key.clone(), metadata.clone());
        if let Some(existing) = self.mods.get(&storage_key) {
            if !id.is_sentinel() {
                if !self.duplicates.contains(&id) {
                    self.duplicates.push(id.clone());
                }
                if let Some(duplicate) = self
                    .duplicate_sources
                    .iter_mut()
                    .find(|duplicate| duplicate.package_id == id)
                {
                    if !duplicate.source_keys.contains(&source_key) {
                        duplicate.source_keys.push(source_key);
                    }
                } else {
                    self.duplicate_sources.push(DuplicatePackageId {
                        package_id: id,
                        source_keys: vec![existing.source_key.clone(), source_key],
                    });
                }
            }
            CatalogInsertResult::Duplicate
        } else {
            self.mods.insert(storage_key, metadata);
            CatalogInsertResult::Inserted
        }
    }

    pub fn get(&self, id: &PackageId) -> Option<&ModMetadata> {
        if id.is_sentinel() {
            return None;
        }
        self.mods.get(&CatalogStorageKey::for_package(id))
    }

    pub fn get_by_source_key(&self, source_key: &ModSourceKey) -> Option<&ModMetadata> {
        self.by_source_key.get(source_key)
    }

    pub fn contains(&self, id: &PackageId) -> bool {
        !id.is_sentinel() && self.mods.contains_key(&CatalogStorageKey::for_package(id))
    }

    pub fn len(&self) -> usize {
        self.mods.len()
    }

    pub fn is_empty(&self) -> bool {
        self.mods.is_empty()
    }

    pub fn iter(&self) -> impl Iterator<Item = (&PackageId, &ModMetadata)> {
        self.mods
            .values()
            .map(|metadata| (&metadata.package_id, metadata))
    }

    pub fn package_ids(&self) -> impl Iterator<Item = &PackageId> {
        self.mods.values().map(|metadata| &metadata.package_id)
    }

    /// Returns the set of duplicate packageIds encountered during insertion.
    pub fn duplicates(&self) -> &[PackageId] {
        &self.duplicates
    }

    pub fn duplicate_sources(&self) -> &[DuplicatePackageId] {
        &self.duplicate_sources
    }

    pub fn duplicate_variants(&self) -> &[DuplicatePackageId] {
        &self.duplicate_sources
    }

    pub fn has_duplicates(&self) -> bool {
        !self.duplicates.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::{CatalogInsertResult, ModCatalog};
    use crate::domain::{ModMetadata, PackageId, Rules};
    use crate::ports::{ModSourceKey, SourceKind};

    fn meta(id: &str, key: &str) -> ModMetadata {
        ModMetadata {
            source_key: ModSourceKey::new(key),
            source_kind: SourceKind::Local,
            package_id: PackageId::new(id),
            name: None,
            authors: Vec::new(),
            supported_versions: Vec::new(),
            description: None,
            mod_version: None,
            url: None,
            mod_icon_path: None,
            steam_app_id: None,
            has_assemblies: false,
            rules: Rules::default(),
            valid: false,
            data_malformed: false,
        }
    }

    #[test]
    fn insert_distinct_mods() {
        let mut cat = ModCatalog::new();
        assert_eq!(cat.insert(meta("a", "ka")), CatalogInsertResult::Inserted);
        assert_eq!(cat.insert(meta("b", "kb")), CatalogInsertResult::Inserted);
        assert_eq!(cat.insert(meta("c", "kc")), CatalogInsertResult::Inserted);
        assert_eq!(cat.len(), 3);
        assert!(!cat.has_duplicates());
        assert!(cat.duplicates().is_empty());
    }

    #[test]
    fn insert_duplicate_keeps_first() {
        let mut cat = ModCatalog::new();
        cat.insert(meta("foo", "first"));
        assert_eq!(
            cat.insert(meta("foo", "second")),
            CatalogInsertResult::Duplicate
        );
        assert_eq!(cat.duplicates().len(), 1);
        let got = cat.get(&PackageId::new("foo")).unwrap();
        assert_eq!(got.source_key.as_str(), "first");
    }

    #[test]
    fn contains_and_get() {
        let mut cat = ModCatalog::new();
        cat.insert(meta("x", "kx"));
        assert!(cat.contains(&PackageId::new("x")));
        assert!(!cat.contains(&PackageId::new("y")));
        assert!(cat.get(&PackageId::new("x")).is_some());
        assert!(cat.get(&PackageId::new("y")).is_none());
    }

    #[test]
    fn iter_and_package_ids() {
        let mut cat = ModCatalog::new();
        cat.insert(meta("a", "ka"));
        cat.insert(meta("b", "kb"));
        let ids: Vec<&str> = cat.package_ids().map(PackageId::as_str).collect();
        assert_eq!(ids, vec!["a", "b"]);
        let pairs: Vec<&str> = cat.iter().map(|(_, m)| m.source_key.as_str()).collect();
        assert_eq!(pairs, vec!["ka", "kb"]);
    }

    #[test]
    fn has_duplicates_true_after_duplicate() {
        let mut cat = ModCatalog::new();
        cat.insert(meta("d", "kd"));
        cat.insert(meta("d", "kd2"));
        assert!(cat.has_duplicates());
        assert_eq!(cat.duplicates().to_vec(), vec![PackageId::new("d")]);
    }

    #[test]
    fn sentinel_package_ids_do_not_create_duplicates() {
        let mut cat = ModCatalog::new();
        assert_eq!(cat.insert(meta("", "ka")), CatalogInsertResult::Inserted);
        assert_eq!(cat.insert(meta("", "kb")), CatalogInsertResult::Inserted);
        assert_eq!(cat.insert(meta("   ", "kc")), CatalogInsertResult::Inserted);
        assert_eq!(cat.len(), 3);
        assert!(
            cat.get(&PackageId::missing()).is_none(),
            "sentinel entries are source-key addressable only"
        );
        assert!(!cat.has_duplicates());
        assert!(cat.duplicates().is_empty());
        assert!(cat.duplicate_sources().is_empty());
        assert_eq!(
            cat.get_by_source_key(&ModSourceKey::new("ka"))
                .expect("first sentinel source key should resolve")
                .source_key
                .as_str(),
            "ka"
        );
        assert_eq!(
            cat.get_by_source_key(&ModSourceKey::new("kb"))
                .expect("second sentinel source key should resolve")
                .source_key
                .as_str(),
            "kb"
        );
    }

    #[test]
    fn source_key_lookup_includes_primary_and_duplicate_variants() {
        let mut cat = ModCatalog::new();
        cat.insert(meta("foo", "first"));
        cat.insert(meta("bar", "third"));
        cat.insert(meta("foo", "second"));

        assert_eq!(
            cat.get_by_source_key(&ModSourceKey::new("first"))
                .expect("primary source key should resolve")
                .package_id,
            PackageId::new("foo")
        );
        assert_eq!(
            cat.get_by_source_key(&ModSourceKey::new("second"))
                .expect("duplicate source key should resolve")
                .package_id,
            PackageId::new("foo")
        );

        let variants = cat.duplicate_variants();
        assert_eq!(variants.len(), 1);
        assert_eq!(variants[0].package_id, PackageId::new("foo"));
        assert_eq!(
            variants[0].source_keys,
            vec![ModSourceKey::new("first"), ModSourceKey::new("second")]
        );
    }
}
