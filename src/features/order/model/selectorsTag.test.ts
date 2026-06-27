import { describe, expect, it } from 'vitest';
import type { ModTagBindingDto, TagDefDto } from '@/commands';
import { mod } from './testFixtures';
import { buildInactiveRenderRows, filterInactiveMods } from './selectors';

describe('order model tag filtering', () => {
  it('filters inactive mods by tag name in the search text', () => {
    const inactiveMods = [
      mod('vanilla.expanded.framework', 'Vanilla Expanded Framework', {
        sourceKey: 'workshop:1',
        authors: ['Oskar'],
      }),
      mod('owlchemist.wallutilities', 'Wall Utilities', {
        sourceKey: 'workshop:2',
        authors: ['Owlchemist'],
      }),
    ];
    const tagDefs: TagDefDto[] = [{ id: 'tag-quality', name: 'Quality' }];
    const modTags: ModTagBindingDto[] = [
      {
        identity: {
          packageId: 'vanilla.expanded.framework',
          sourceKind: 'local',
          sourceKey: 'workshop:1',
        },
        tagIds: ['tag-quality'],
      },
    ];

    expect(
      filterInactiveMods(inactiveMods, [], 'qual', modTags, tagDefs, '').map(
        (item) => item.packageId,
      ),
    ).toEqual(['vanilla.expanded.framework']);
  });

  it('filters inactive mods by selected tag id', () => {
    const inactiveMods = [
      mod('vanilla.expanded.framework', 'Vanilla Expanded Framework', {
        sourceKey: 'workshop:1',
        authors: ['Oskar'],
      }),
      mod('owlchemist.wallutilities', 'Wall Utilities', {
        sourceKey: 'workshop:2',
        authors: ['Owlchemist'],
      }),
    ];
    const tagDefs: TagDefDto[] = [
      { id: 'tag-quality', name: 'Quality' },
      { id: 'tag-cosmetic', name: 'Cosmetic' },
    ];
    const modTags: ModTagBindingDto[] = [
      {
        identity: {
          packageId: 'vanilla.expanded.framework',
          sourceKind: 'local',
          sourceKey: 'workshop:1',
        },
        tagIds: ['tag-quality'],
      },
      {
        identity: {
          packageId: 'owlchemist.wallutilities',
          sourceKind: 'local',
          sourceKey: 'workshop:2',
        },
        tagIds: ['tag-cosmetic'],
      },
    ];

    expect(
      filterInactiveMods(inactiveMods, [], '', modTags, tagDefs, 'tag-quality').map(
        (item) => item.packageId,
      ),
    ).toEqual(['vanilla.expanded.framework']);
    expect(
      filterInactiveMods(inactiveMods, [], '', modTags, tagDefs, 'tag-cosmetic').map(
        (item) => item.packageId,
      ),
    ).toEqual(['owlchemist.wallutilities']);
    expect(
      filterInactiveMods(inactiveMods, [], '', modTags, tagDefs, '').map((item) => item.packageId),
    ).toEqual(['vanilla.expanded.framework', 'owlchemist.wallutilities']);
  });
});

describe('order model tag render rows', () => {
  it('builds inactive render rows filtered by tag from catalog and missing structured rows', () => {
    const tagDefs: TagDefDto[] = [{ id: 'tag-q', name: 'Quality' }];
    const modTags: ModTagBindingDto[] = [
      { identity: { packageId: 'missing.mod' }, tagIds: ['tag-q'] },
      {
        identity: { packageId: 'c.extra', sourceKind: 'local', sourceKey: 'local:c.extra' },
        tagIds: ['tag-q'],
      },
    ];
    const rows = buildInactiveRenderRows(
      [
        {
          kind: 'group',
          id: 'group-mixed',
          name: 'Mixed group',
          collapsed: false,
          entries: [
            { id: 'child-active', active: true, identity: { packageId: 'a.core' } },
            { id: 'child-missing', active: false, identity: { packageId: 'missing.mod' } },
            { id: 'child-other', active: false, identity: { packageId: 'other.mod' } },
          ],
        },
      ],
      [mod('b.dep', 'Dependency'), mod('c.extra', 'Extra'), mod('d.other', 'Other')],
      {
        query: '',
        aliases: [],
        modByPackageId: new Map([
          ['a.core', mod('a.core', 'Core')],
          ['b.dep', mod('b.dep', 'Dependency')],
          ['c.extra', mod('c.extra', 'Extra')],
          ['d.other', mod('d.other', 'Other')],
        ]),
        modTags,
        tagDefs,
        tagFilter: 'tag-q',
      },
    );

    expect(rows.map((row) => row.id)).toEqual([
      'inactive:entry:group-mixed',
      'inactive:child:group-mixed:child-missing',
      'inactive:catalog:c.extra',
    ]);
  });
});
