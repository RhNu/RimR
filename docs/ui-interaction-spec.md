# RimR UI 交互规约

## 排序工作区

`/order` 使用桌面工具式三栏布局：

- 左栏是常驻元数据栏，跟随当前选中项实时刷新。
- 中栏是未启用 / 未引入 mods；其中 Group 是保留在模组列表草稿中的暂存结构。
- 右栏是当前模组列表 entries，包括 mod、group 和 separator。

主视图保持干净，不直接放置用于编辑的文本输入框。所有需要输入文本、确认破坏性操作或编辑实体属性的操作都进入二级界面。

## 顶栏

排序页顶栏只承担状态和全局动作：

- 当前模组列表切换。
- mod list unsaved、Not applied 和校验摘要。
- Save Mod List。
- Apply。
- Sync from Game Order：重新读取 `ModsConfig.xml`，把当前 draft 对齐到外部修改后的游戏排序；若会覆盖未保存改动或调整 Group/Separator，会先显示确认。
- Reset to Saved。
- 模组列表管理菜单。

模组列表新建、重命名和删除不在主视图直接显示输入框。新建和重命名使用 Dialog；删除使用确认 Dialog。

排序工具栏中 `Sync from Game Order` 旁的重置图标表示重新扫描并重建当前 catalog。扫描完成后按最新 catalog 清理当前 draft 中的缺失 mod：缺失项若只在 Inactive 区域，提示后自动从 draft 移除；缺失项若仍在 Active 区域，必须显示确认弹窗，用户确认后才从 draft 移除。该流程只修改 draft，不写 RimR 模组列表，也不写 `ModsConfig.xml`；保存和应用仍由 `Save` / `Apply` 显式触发。

## 元数据栏

元数据栏展示只读信息：

- mod 名称、Package ID、来源、作者、版本、支持的游戏版本。
- 路径、Preview.png 缩略图、文件夹大小、mtime 等按选中项懒加载的文件信息。
- 依赖、加载顺序规则、不兼容规则。
- 与当前选中项相关的诊断。
- 描述文本。

元数据栏不承载编辑行为。Display Alias 等用户自定义字段通过 ContextMenu 打开 Dialog 编辑。

## 列表与 ContextMenu

列表行是主要操作对象。左键选择并更新元数据栏；拖拽改变排序或从未引入列表加入 active；右键打开 ContextMenu。

支持 Ctrl/Cmd 多选和 Shift 范围多选。多选状态用于创建 group，不使用行内复选框。ContextMenu 根据当前列表、当前选中项和多选数量启用或禁用操作。

未引入列表的 ContextMenu：

- Add to Active。
- Create Group from Selection。
- Edit Display Alias。

Inactive 中的结构化 Group / child ContextMenu：

- Add to Active。
- Rename Group（仅 Group）。
- Edit Display Alias（仅 mod / child）。

Active 列表的 mod ContextMenu：

- Remove from Active（仅停用该 mod，保留结构化 entry 以便从 Inactive 恢复）。
- Create Group from Selection。
- Edit Display Alias。
- Add Separator Above。

Group ContextMenu：

- Rename Group。
- Ungroup。
- Remove Group（停用该 Group 的 children，保留 Group 名称与组内顺序，以便从 Inactive 恢复）。

Separator ContextMenu：

- Rename Separator。
- Delete Separator（真正删除 separator entry）。

## Dialog

Dialog 是所有编辑输入的唯一入口：

- New Mod List。
- Rename Mod List。
- Delete Mod List。
- Edit Display Alias。
- Create Group。
- Rename Group。
- Add Separator。
- Rename Separator。
- Reset to Saved confirmation。

Dialog 只在提交时修改 draft 或持久化状态；取消不产生副作用。

## Separator

Separator 是模组列表 entry，和普通 active entry 一样可拖动排序。它只存在于 RimR 模组列表中，Apply 到游戏 `ModsConfig.xml` 时必须忽略。

创建 separator 的默认入口是 Active 列表 ContextMenu 的 `Add Separator Above`。创建时插入到右键目标 entry 上方；若从 Active 列表空白处触发，则插入到列表末尾。
