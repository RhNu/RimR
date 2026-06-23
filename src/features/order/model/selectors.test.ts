import { describe, expect, it } from 'vitest';
import type { DisplayAliasDto, ModTagBindingDto, TagDefDto } from '@/commands';
import { baseEntries, mod } from './testFixtures';
import {
  activeModEntryIds,
  activeModsKey,
  buildActiveRenderRows,
  buildInactiveRenderRows,
  canCreateActiveGroup,
  canCreateInactiveGroup,
  filterInactiveMods,
  formatFileSize,
  pruneSelection,
  selectedDragIds,
  updateSelectionForClick,
} from './selectors';

describe('order model selector helpers', () => {
  it('updates row selections from plain, toggle, and range clicks', () => {
    const plain = updateSelectionForClick(new Set(['a', 'b']), ['a', 'b', 'c'], 'c', {}, 'a');
    expect([...plain.selected]).toEqual(['c']);
    expect(plain.anchorId).toBe('c');

    const toggled = updateSelectionForClick(
      new Set(['a']),
      ['a', 'b'],
      'b',
      { ctrlKey: true },
      'a',
    );
    expect([...toggled.selected]).toEqual(['a', 'b']);
    expect(toggled.anchorId).toBe('b');

    const range = updateSelectionForClick(
      new Set(['b']),
      ['a', 'b', 'c', 'd'],
      'd',
      { shiftKey: true },
      'b',
    );
    expect([...range.selected]).toEqual(['b', 'c', 'd']);
    expect(range.anchorId).toBe('b');
  });

  it('reports when group actions are available', () => {
    expect(canCreateActiveGroup(new Set(['a']))).toBe(false);
    expect(canCreateActiveGroup(new Set(['a', 'b']))).toBe(true);
    expect(canCreateInactiveGroup(new Set())).toBe(false);
    expect(canCreateInactiveGroup(new Set(['a']))).toBe(true);
  });

  it('formats file sizes for compact metadata display', () => {
    expect(formatFileSize(null)).toBe('—');
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2 MB');
  });

  it('builds stable active mod keys and top-level mod entry ids', () => {
    expect(activeModsKey(['core', 'harmony', 'ui'])).toBe('core\u0000harmony\u0000ui');
    expect(activeModEntryIds(baseEntries())).toEqual(['entry-a']);
  });
});

describe('order model render selectors', () => {
  it('filters inactive mods by alias, package metadata, and source key', () => {
    const aliases: DisplayAliasDto[] = [
      {
        identity: {
          packageId: 'vanilla.expanded.framework',
          sourceKind: 'local',
          sourceKey: 'workshop:1',
        },
        displayAlias: 'VE Framework',
      },
    ];
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

    expect(
      filterInactiveMods(inactiveMods, aliases, 've frame', [], [], '').map(
        (item) => item.packageId,
      ),
    ).toEqual(['vanilla.expanded.framework']);
    expect(
      filterInactiveMods(inactiveMods, aliases, 'owl', [], [], '').map((item) => item.packageId),
    ).toEqual(['owlchemist.wallutilities']);
    expect(
      filterInactiveMods(inactiveMods, aliases, 'workshop:2', [], [], '').map(
        (item) => item.packageId,
      ),
    ).toEqual(['owlchemist.wallutilities']);
  });

  it('builds active render rows that keep a matching group with matching children', () => {
    const rows = buildActiveRenderRows(baseEntries(), {
      query: 'dep',
      aliases: [],
      modByPackageId: new Map([
        ['a.core', mod('a.core', 'Core')],
        ['b.dep', mod('b.dep', 'Dependency')],
      ]),
    });

    expect(rows.map((row) => row.id)).toEqual([
      'active:entry:group-required',
      'active:child:group-required:child-b',
    ]);
  });

  it('builds inactive render rows for mixed groups and missing children', () => {
    const rows = buildInactiveRenderRows(
      [
        {
          kind: 'group',
          id: 'group-mixed',
          name: 'Mixed group',
          collapsed: false,
          entries: [
            { id: 'child-active', active: true, identity: { packageId: 'a.core' } },
            { id: 'child-inactive', active: false, identity: { packageId: 'b.dep' } },
            { id: 'child-missing', active: false, identity: { packageId: 'missing.mod' } },
          ],
        },
      ],
      [mod('c.extra', 'Extra')],
      {
        query: '',
        aliases: [],
        modByPackageId: new Map([
          ['a.core', mod('a.core', 'Core')],
          ['b.dep', mod('b.dep', 'Dependency')],
          ['c.extra', mod('c.extra', 'Extra')],
        ]),
        modTags: [],
        tagDefs: [],
        tagFilter: '',
      },
    );

    expect(rows.map((row) => row.id)).toEqual([
      'inactive:entry:group-mixed',
      'inactive:child:group-mixed:child-inactive',
      'inactive:child:group-mixed:child-missing',
      'inactive:catalog:c.extra',
    ]);
    expect(rows[2]).toMatchObject({ kind: 'child', missing: true });
  });

  it('prunes hidden selections and keeps the selected drag payload ordered by selection', () => {
    expect([...pruneSelection(new Set(['a', 'b', 'c']), ['a', 'c'])]).toEqual(['a', 'c']);
    expect(selectedDragIds('b', new Set(['a', 'b', 'c']))).toEqual(['a', 'b', 'c']);
    expect(selectedDragIds('d', new Set(['a', 'b', 'c']))).toEqual(['d']);
  });
});

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
  it('builds inactive render rows filtered by tag, keeping group children that have the tag', () => {
    const tagDefs: TagDefDto[] = [{ id: 'tag-q', name: 'Quality' }];
    const modTags: ModTagBindingDto[] = [
      { identity: { packageId: 'b.dep' }, tagIds: ['tag-q'] },
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
            { id: 'child-inactive', active: false, identity: { packageId: 'b.dep' } },
            { id: 'child-other', active: false, identity: { packageId: 'other.mod' } },
          ],
        },
      ],
      [mod('c.extra', 'Extra'), mod('d.other', 'Other')],
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
      'inactive:child:group-mixed:child-inactive',
      'inactive:catalog:c.extra',
    ]);
  });
});
