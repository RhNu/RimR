import { describe, expect, it } from 'vitest';
import { baseDisplayName, baseLabelForIdentity } from './identity';
import { mod } from './model/testFixtures';

describe('identity base labels', () => {
  it('returns the official display name for official mods', () => {
    expect(baseDisplayName(mod('ludeon.rimworld', 'Core', { sourceKind: 'expansion' }))).toBe(
      'RimWorld',
    );
  });

  it('falls back to mod name when no official name exists', () => {
    expect(baseDisplayName(mod('foo.bar', 'Foo Bar'))).toBe('Foo Bar');
  });

  it('falls back to package id when name is missing', () => {
    expect(baseDisplayName(mod('baz.qux', '', { name: null }))).toBe('baz.qux');
  });

  it('resolves base label from a package id map', () => {
    const foo = mod('foo.bar', 'Foo Bar');
    const modByPackageId = new Map([['foo.bar', foo]]);
    expect(
      baseLabelForIdentity(
        {
          packageId: 'foo.bar',
          sourceKind: 'local',
          sourceKey: 'local:foo.bar',
          steamAppId: null,
        },
        modByPackageId,
      ),
    ).toBe('Foo Bar');
  });

  it('falls back to package id when mod is not in the map', () => {
    expect(
      baseLabelForIdentity(
        {
          packageId: 'missing.mod',
          sourceKind: 'local',
          sourceKey: 'local:missing.mod',
          steamAppId: null,
        },
        new Map(),
      ),
    ).toBe('missing.mod');
  });
});
