import { describe, expect, it } from 'vitest';
import type { DisplayAliasDto } from '@/commands';
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

  it('builds active render rows without filtering legacy inactive flags', () => {
    const rows = buildActiveRenderRows(
      [
        { kind: 'mod', id: 'entry-a', active: false, identity: { packageId: 'a.core' } },
        {
          kind: 'group',
          id: 'group-required',
          name: 'Required',
          collapsed: false,
          entries: [{ id: 'child-b', active: false, identity: { packageId: 'b.dep' } }],
        },
      ],
      {
        query: '',
        aliases: [],
        modByPackageId: new Map([
          ['a.core', mod('a.core', 'Core')],
          ['b.dep', mod('b.dep', 'Dependency')],
        ]),
      },
    );

    expect(rows.map((row) => row.id)).toEqual([
      'active:entry:entry-a',
      'active:entry:group-required',
      'active:child:group-required:child-b',
    ]);
  });

  it('builds inactive render rows from catalog mods and missing structured entries', () => {
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
      [mod('b.dep', 'Dependency'), mod('c.extra', 'Extra')],
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
      'inactive:child:group-mixed:child-missing',
      'inactive:catalog:b.dep',
      'inactive:catalog:c.extra',
    ]);
    expect(rows[1]).toMatchObject({ kind: 'child', missing: true });
  });

  it('prunes hidden selections and keeps the selected drag payload ordered by selection', () => {
    expect([...pruneSelection(new Set(['a', 'b', 'c']), ['a', 'c'])]).toEqual(['a', 'c']);
    expect(selectedDragIds('b', new Set(['a', 'b', 'c']))).toEqual(['a', 'b', 'c']);
    expect(selectedDragIds('d', new Set(['a', 'b', 'c']))).toEqual(['d']);
  });
});

describe('order model inactive render sorting', () => {
  it('renders installed top-level inactive entries in catalog sort order', () => {
    const rows = buildInactiveRenderRows(
      [
        {
          kind: 'mod',
          id: 'entry-z',
          active: false,
          identity: { packageId: 'z.core' },
        },
      ],
      [mod('a.core', 'Alpha'), mod('z.core', 'Zeta')],
      {
        query: '',
        aliases: [],
        modByPackageId: new Map([
          ['a.core', mod('a.core', 'Alpha')],
          ['z.core', mod('z.core', 'Zeta')],
        ]),
        modTags: [],
        tagDefs: [],
        tagFilter: '',
      },
    );

    expect(rows.map((row) => row.id)).toEqual([
      'inactive:catalog:a.core',
      'inactive:catalog:z.core',
    ]);
  });

  it('keeps inactive groups above ordinary mods and sorts both sections by modified time', () => {
    const rows = buildInactiveRenderRows(
      [
        {
          kind: 'group',
          id: 'group-cold',
          name: 'Cold group',
          collapsed: false,
          entries: [{ id: 'child-b', active: false, identity: { packageId: 'b.dep' } }],
        },
        {
          kind: 'mod',
          id: 'entry-missing',
          active: false,
          identity: { packageId: 'missing.mod' },
        },
        {
          kind: 'group',
          id: 'group-hot',
          name: 'Hot group',
          collapsed: false,
          entries: [
            { id: 'child-a', active: false, identity: { packageId: 'a.core' } },
            { id: 'child-c', active: false, identity: { packageId: 'c.extra' } },
          ],
        },
      ],
      [mod('m.mid', 'Middle', { modifiedAtMs: 20 }), mod('z.low', 'Low', { modifiedAtMs: 1 })],
      {
        query: '',
        aliases: [],
        modByPackageId: new Map([
          ['a.core', mod('a.core', 'Alpha', { modifiedAtMs: 5 })],
          ['b.dep', mod('b.dep', 'Beta', { modifiedAtMs: 10 })],
          ['c.extra', mod('c.extra', 'Charlie', { modifiedAtMs: 30 })],
          ['m.mid', mod('m.mid', 'Middle', { modifiedAtMs: 20 })],
          ['z.low', mod('z.low', 'Low', { modifiedAtMs: 1 })],
        ]),
        modTags: [],
        tagDefs: [],
        tagFilter: '',
        sortKey: 'modifiedAt',
        sortDirection: 'desc',
      },
    );

    expect(rows.map((row) => row.id)).toEqual([
      'inactive:catalog:m.mid',
      'inactive:catalog:z.low',
      'inactive:entry:entry-missing',
    ]);
  });
});
