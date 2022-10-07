# bizify

## 如何开始

> 推荐使用 `pnpm` 作为包管理工具

```bash
# 安装依赖
pnpm i

# Run dev
pnpm start

# 单元测试
pnpm test

# 发布（run 不能丢）
pnpm run pub

# 发布文档（推送到 gh-pages）
pnpm run pub:doc
```

## Commit 规则

```
feat	新功能（feature）
fix	修补bug
docs	文档（documentation）
style	格式（不影响代码运行的变动）
refactor	重构（即不是新增功能，也不是修改bug的代码变动）
test	增加测试
chore	构建过程或辅助工具的变动
```

## Lerna 使用

> https://github.com/lerna/lerna

```bash
# 初始化依赖（包含子包）和链接跨包依赖
lerna bootstrap

# 创建一个子包
lerna create <pkg>

# 遍历执行每个包下的script，如果不存在则忽略
lerna run [script]

# 安装依赖包，可使用 lerna add --help 查看帮助
lerna add <pkg>
# 在特定的子包中安装依赖，可增加参数 --dev --peer
lerna add <pkg> --scope=xxx
```
