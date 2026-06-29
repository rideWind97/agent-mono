/**
 * ============================================================
 * Part 1: 微调数据集准备 —— Fine-tuning 的成败在于数据质量
 * ============================================================
 *
 * 微调数据集的黄金法则：
 *   "Garbage In, Garbage Out" —— 数据质量决定微调效果
 *
 * OpenAI Fine-tuning 数据格式：
 *   - 文件格式：JSONL（每行一个 JSON 对象）
 *   - 每条数据包含一个 messages 数组
 *   - messages 结构与 Chat Completions API 一致：
 *     [{ role: "system", content: "..." },
 *      { role: "user", content: "..." },
 *      { role: "assistant", content: "..." }]
 *
 * 数据准备流程：
 *   1. 设计数据 Schema（明确 system/user/assistant 各写什么）
 *   2. 编写或收集高质量样本
 *   3. 数据清洗（去重、格式校验、长度过滤）
 *   4. 质量验证（Token 统计、格式检查）
 *   5. 训练集/验证集拆分
 *
 * 本文件演示：
 *   - 生成 50+ 条高质量微调样本（代码审查助手场景）
 *   - 完整的数据清洗与验证 Pipeline
 *   - 输出符合 OpenAI 格式的 JSONL 文件
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { printSection, printStep } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "..", "data");

// ============================================================
// 第一步：定义微调数据 Schema
// ============================================================

/**
 * 微调场景：代码审查助手
 *
 * 为什么选这个场景？
 *   - 输入输出格式明确（代码 → 审查意见）
 *   - 可以定义一致的输出风格（结构化评审）
 *   - 有明确的评估标准（覆盖了哪些审查维度）
 *   - Prompt Engineering 难以完美解决（需要深度代码理解 + 固定格式）
 */
interface FinetuneMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface FinetuneSample {
  messages: FinetuneMessage[];
}

const SYSTEM_PROMPT = `你是一个专业的代码审查助手。请按以下固定格式输出审查意见：

## 审查结果
- 严重程度：[低/中/高/严重]
- 类别：[安全/性能/可读性/最佳实践/错误处理]

## 问题描述
[一句话描述问题]

## 建议修改
[给出具体的修改方案]`;

// ============================================================
// 第二步：编写高质量微调样本
// ============================================================

/**
 * 50+ 条微调样本
 *
 * 高质量样本的标准：
 *   1. 输入多样化（覆盖不同语言、不同问题类型）
 *   2. 输出格式严格一致（模型要学会这个固定格式）
 *   3. 内容准确（审查意见要正确）
 *   4. system prompt 每条都一样（让模型学会角色）
 */
const SAMPLES: Array<{ code: string; review: string }> = [
  // ── 安全类 ──
  {
    code: `function login(user, pass) {\n  const query = "SELECT * FROM users WHERE name='" + user + "' AND pass='" + pass + "'";\n  return db.execute(query);\n}`,
    review: `## 审查结果\n- 严重程度：严重\n- 类别：安全\n\n## 问题描述\n存在 SQL 注入漏洞，直接拼接用户输入到 SQL 语句中。\n\n## 建议修改\n使用参数化查询：\`db.execute("SELECT * FROM users WHERE name=? AND pass=?", [user, pass])\``,
  },
  {
    code: `app.get('/api/user/:id', (req, res) => {\n  res.send(users[req.params.id]);\n});`,
    review: `## 审查结果\n- 严重程度：高\n- 类别：安全\n\n## 问题描述\n缺少权限校验，任意用户可通过修改 id 访问他人信息。\n\n## 建议修改\n添加身份验证中间件，并校验请求者是否有权限访问目标用户数据。`,
  },
  {
    code: `const token = localStorage.getItem('auth_token');\nfetch('/api/data', { headers: { Authorization: token } });`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：安全\n\n## 问题描述\nlocalStorage 存储 token 存在 XSS 攻击风险。\n\n## 建议修改\n改用 HttpOnly Cookie 存储 token，或添加 CSP 策略防御 XSS。`,
  },
  {
    code: `function hashPassword(password) {\n  return crypto.createHash('md5').update(password).digest('hex');\n}`,
    review: `## 审查结果\n- 严重程度：严重\n- 类别：安全\n\n## 问题描述\nMD5 已被证明不安全，不应用于密码哈希。\n\n## 建议修改\n使用 bcrypt 或 argon2：\`await bcrypt.hash(password, 12)\``,
  },
  {
    code: `eval(userInput);`,
    review: `## 审查结果\n- 严重程度：严重\n- 类别：安全\n\n## 问题描述\neval 执行用户输入会导致远程代码执行漏洞（RCE）。\n\n## 建议修改\n禁止使用 eval，改用安全的 JSON.parse 或 AST 解析方案。`,
  },
  // ── 性能类 ──
  {
    code: `const result = [];\nfor (let i = 0; i < arr.length; i++) {\n  if (arr.indexOf(arr[i]) === i) {\n    result.push(arr[i]);\n  }\n}`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：性能\n\n## 问题描述\nindexOf 在循环内调用导致 O(n²) 时间复杂度。\n\n## 建议修改\n使用 Set 去重：\`const result = [...new Set(arr)]\`，时间复杂度 O(n)。`,
  },
  {
    code: `useEffect(() => {\n  fetch('/api/data').then(res => res.json()).then(setData);\n});`,
    review: `## 审查结果\n- 严重程度：高\n- 类别：性能\n\n## 问题描述\nuseEffect 缺少依赖数组，每次渲染都会重复请求 API。\n\n## 建议修改\n添加空依赖数组：\`useEffect(() => { ... }, [])\` 使请求只在挂载时执行一次。`,
  },
  {
    code: `function processItems(items) {\n  return items.map(i => transform(i)).filter(i => i.valid).map(i => format(i));\n}`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：性能\n\n## 问题描述\n三次遍历数组，大数据量下有性能问题。\n\n## 建议修改\n使用 reduce 合并为一次遍历，或使用 for 循环同时完成转换、过滤和格式化。`,
  },
  {
    code: `const Component = ({ items }) => (\n  <div>{items.map(item => <ExpensiveChild key={item.id} data={item} />)}</div>\n);`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：性能\n\n## 问题描述\n父组件每次渲染都会导致所有 ExpensiveChild 重新渲染。\n\n## 建议修改\n用 React.memo 包裹 ExpensiveChild，或用 useMemo 缓存列表渲染结果。`,
  },
  {
    code: `document.querySelectorAll('.item').forEach(el => {\n  el.addEventListener('click', handleClick);\n});`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：性能\n\n## 问题描述\n为每个元素单独绑定事件，元素多时占用大量内存。\n\n## 建议修改\n使用事件委托：在父元素上监听一次 click 事件，通过 event.target 判断来源。`,
  },
  // ── 可读性类 ──
  {
    code: `const x = a ? (b ? 1 : 2) : (c ? 3 : (d ? 4 : 5));`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：可读性\n\n## 问题描述\n嵌套三元表达式难以阅读和维护。\n\n## 建议修改\n改用 if-else 或 switch 语句，或提取为独立函数并用有意义的命名。`,
  },
  {
    code: `function f(a, b, c, d, e, f, g) { return a + b * c - d / e + f % g; }`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：可读性\n\n## 问题描述\n函数参数过多且命名为单字母，无法理解各参数含义。\n\n## 建议修改\n将参数合并为配置对象，并使用有意义的命名：\`function calculate({ price, quantity, tax, ... })\``,
  },
  {
    code: `// TODO: fix this later\nfunction temp() {\n  // hack: this works somehow\n  return data.split('').reverse().join('').split('').reverse().join('');\n}`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：可读性\n\n## 问题描述\n存在 TODO 和 hack 注释，函数命名为 temp，代码逻辑不清晰。\n\n## 建议修改\n理清实际需求，用有意义的函数名替换 temp，消除 hack 逻辑并移除过期 TODO。`,
  },
  // ── 最佳实践类 ──
  {
    code: `let config = {};\ntry {\n  config = JSON.parse(fs.readFileSync('config.json', 'utf8'));\n} catch (e) {}`,
    review: `## 审查结果\n- 严重程度：高\n- 类别：错误处理\n\n## 问题描述\ncatch 块为空，静默吞掉所有错误，配置文件损坏时无任何提示。\n\n## 建议修改\n在 catch 中记录错误日志，或抛出自定义异常：\`catch (e) { logger.error('配置加载失败', e); throw e; }\``,
  },
  {
    code: `async function fetchAll(urls) {\n  const results = [];\n  for (const url of urls) {\n    results.push(await fetch(url));\n  }\n  return results;\n}`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：最佳实践\n\n## 问题描述\n循环中串行 await 每个请求，无法利用并发优势。\n\n## 建议修改\n使用 \`Promise.all(urls.map(url => fetch(url)))\` 并发执行所有请求。`,
  },
  {
    code: `function getUser(id) {\n  return new Promise((resolve, reject) => {\n    db.query('SELECT * FROM users WHERE id = ?', [id], (err, rows) => {\n      if (err) reject(err);\n      else resolve(rows[0]);\n    });\n  });\n}`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：最佳实践\n\n## 问题描述\n手动构造 Promise 包裹回调，代码冗长。\n\n## 建议修改\n使用 util.promisify 或数据库驱动自带的 Promise 接口简化代码。`,
  },
  {
    code: `if (status === 'active') {\n  return true;\n} else {\n  return false;\n}`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：最佳实践\n\n## 问题描述\n冗余的 if-else 返回布尔值。\n\n## 建议修改\n直接返回表达式：\`return status === 'active'\``,
  },
  {
    code: `const arr = [1, 2, 3];\ndelete arr[1];\nconsole.log(arr.length);`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：最佳实践\n\n## 问题描述\ndelete 操作符不会改变数组长度，会留下 empty slot，导致后续遍历异常。\n\n## 建议修改\n使用 splice 删除元素：\`arr.splice(1, 1)\`，或用 filter 生成新数组。`,
  },
  // ── 错误处理类 ──
  {
    code: `const data = JSON.parse(response.body);`,
    review: `## 审查结果\n- 严重程度：高\n- 类别：错误处理\n\n## 问题描述\n未对 JSON.parse 做 try-catch，非法 JSON 会导致进程崩溃。\n\n## 建议修改\n用 try-catch 包裹并处理解析失败情况，或使用安全解析工具。`,
  },
  {
    code: `async function save(data) {\n  await db.insert(data);\n  await cache.set(data.id, data);\n  await notify(data);\n}`,
    review: `## 审查结果\n- 严重程度：高\n- 类别：错误处理\n\n## 问题描述\n三个操作串行执行且无事务保护，中间步骤失败会导致数据不一致。\n\n## 建议修改\n使用数据库事务包裹写操作，缓存和通知失败应有补偿机制或重试队列。`,
  },
  // ── 补充样本：覆盖更多语言和模式 ──
  {
    code: `const password = "admin123";`,
    review: `## 审查结果\n- 严重程度：严重\n- 类别：安全\n\n## 问题描述\n硬编码密码在源代码中，任何有代码访问权限的人都能看到。\n\n## 建议修改\n使用环境变量或密钥管理服务（如 AWS Secrets Manager）存储敏感信息。`,
  },
  {
    code: `function debounce(fn, delay) {\n  let timer;\n  return function() {\n    clearTimeout(timer);\n    timer = setTimeout(fn, delay);\n  };\n}`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：最佳实践\n\n## 问题描述\n防抖函数丢失了 this 上下文和参数传递。\n\n## 建议修改\n使用箭头函数或 apply 保留上下文：\`timer = setTimeout(() => fn.apply(this, args), delay)\``,
  },
  {
    code: `for (var i = 0; i < 5; i++) {\n  setTimeout(() => console.log(i), 100);\n}`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：最佳实践\n\n## 问题描述\nvar 声明导致闭包问题，所有回调共享同一个 i，最终都输出 5。\n\n## 建议修改\n将 var 改为 let：\`for (let i = 0; ...)\`，let 具有块级作用域。`,
  },
  {
    code: `import _ from 'lodash';\nconst result = _.get(data, 'a.b.c');`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：性能\n\n## 问题描述\n仅使用 lodash 的 get 方法却引入整个库，增加约 70KB 包体积。\n\n## 建议修改\n使用可选链替代：\`const result = data?.a?.b?.c\`，或按需引入 \`lodash/get\`。`,
  },
  {
    code: `class UserService {\n  async getUser(id) { /* 200行代码 */ }\n  async updateUser(id, data) { /* 150行代码 */ }\n  async deleteUser(id) { /* 100行代码 */ }\n  async sendEmail(userId, subject, body) { /* 80行代码 */ }\n  async generateReport(userId) { /* 120行代码 */ }\n}`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：可读性\n\n## 问题描述\n单个类承担过多职责（用户 CRUD + 邮件 + 报告），违反单一职责原则。\n\n## 建议修改\n拆分为 UserRepository、EmailService、ReportService 等独立模块。`,
  },
  {
    code: `try {\n  const res = await fetch(url);\n  return res.json();\n} catch (e) {\n  return null;\n}`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：错误处理\n\n## 问题描述\n捕获异常后返回 null，调用方无法区分「无数据」和「请求失败」。\n\n## 建议修改\n抛出自定义错误或返回 Result 类型：\`{ ok: false, error: e.message }\`。`,
  },
  {
    code: `const isValid = str.match(/^[a-zA-Z0-9]+$/) !== null ? true : false;`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：最佳实践\n\n## 问题描述\n\`!== null ? true : false\` 是冗余比较。\n\n## 建议修改\n直接使用 test：\`const isValid = /^[a-zA-Z0-9]+$/.test(str)\``,
  },
  {
    code: `function Component() {\n  const [count, setCount] = useState(0);\n  const handleClick = () => setCount(count + 1);\n  return <button onClick={handleClick}>{count}</button>;\n}`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：最佳实践\n\n## 问题描述\n使用旧值 count 更新状态，在快速连续点击时可能丢失更新。\n\n## 建议修改\n使用函数式更新：\`setCount(prev => prev + 1)\` 确保基于最新值。`,
  },
  {
    code: `setTimeout(() => {\n  setLoading(false);\n  setData(result);\n  setError(null);\n}, 0);`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：最佳实践\n\n## 问题描述\n使用 setTimeout(fn, 0) 绕过状态更新时序问题，属于 hack 写法。\n\n## 建议修改\n使用 React 18 的自动批处理或 flushSync，或重新审视状态更新逻辑。`,
  },
  {
    code: `export default function() {\n  return <div>Hello</div>;\n}`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：可读性\n\n## 问题描述\n匿名默认导出使得在 DevTools 和堆栈追踪中无法看到组件名。\n\n## 建议修改\n使用具名函数：\`export default function Greeting() { ... }\``,
  },
  // ── 补充：安全 / 注入 / 配置 ──
  {
    code: `res.send(req.query.html);`,
    review: `## 审查结果\n- 严重程度：严重\n- 类别：安全\n\n## 问题描述\n直接将查询参数作为 HTML 返回，存在反射型 XSS。\n\n## 建议修改\n对用户输入做转义（如 DOMPurify / 禁止 raw HTML），或仅允许白名单标签。`,
  },
  {
    code: `const path = req.query.path;\nfs.readFileSync('/data/' + path);`,
    review: `## 审查结果\n- 严重程度：严重\n- 类别：安全\n\n## 问题描述\n路径拼接未规范化，攻击者可用 \`../\` 读取任意文件（路径穿越）。\n\n## 建议修改\n使用 \`path.resolve\` + 固定根目录校验，或 \`path.join\` 后检查是否仍在允许目录内。`,
  },
  {
    code: `app.post('/transfer', (req, res) => {\n  transfer(req.body.amount, req.body.to);\n});`,
    review: `## 审查结果\n- 严重程度：高\n- 类别：安全\n\n## 问题描述\n敏感操作缺少 CSRF Token 与来源校验，可能被跨站请求伪造。\n\n## 建议修改\n使用 CSRF 中间件、SameSite Cookie、或二次确认/二次认证。`,
  },
  {
    code: `const sessionId = Math.random().toString();`,
    review: `## 审查结果\n- 严重程度：高\n- 类别：安全\n\n## 问题描述\nMath.random 不可用于会话 ID 等安全场景，存在可预测性。\n\n## 建议修改\n使用 \`crypto.randomBytes(32).toString('hex')\` 等密码学安全随机数。`,
  },
  {
    code: `const admin = req.headers['x-admin'] === 'true';\nif (admin) grantAccess();`,
    review: `## 审查结果\n- 严重程度：严重\n- 类别：安全\n\n## 问题描述\n信任客户端可伪造的 Header 作为权限依据。\n\n## 建议修改\n在服务端根据已认证用户角色/权限表判定，不依赖用户可控 Header。`,
  },
  // ── 性能 / 资源 ──
  {
    code: `async function listOrders() {\n  const users = await db.user.findMany();\n  for (const u of users) {\n    u.orders = await db.order.findMany({ where: { userId: u.id } });\n  }\n  return users;\n}`,
    review: `## 审查结果\n- 严重程度：高\n- 类别：性能\n\n## 问题描述\n循环内逐条查询订单，经典 N+1 查询，数据量一大就会拖垮数据库。\n\n## 建议修改\n使用 \`include: { orders: true }\` 或批量 IN 查询一次取回关联数据。`,
  },
  {
    code: `app.get('/file/:name', (req, res) => {\n  const data = fs.readFileSync(req.params.name, 'utf8');\n  res.send(data);\n});`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：性能\n\n## 问题描述\n在请求处理中同步读文件，会阻塞事件循环，高并发时延迟剧增。\n\n## 建议修改\n使用 \`fs.promises.readFile\` 或 \`fs.createReadStream\` 异步/流式读取。`,
  },
  {
    code: `const cache = new Map();\nsetInterval(() => { cache.clear(); }, 1000);`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：性能\n\n## 问题描述\n全局 Map 无大小上限，异常流量下可能 OOM；定时全量 clear 也过于粗暴。\n\n## 建议修改\n使用 LRU（如 lru-cache）、或按条目 TTL + 最大条数限制。`,
  },
  {
    code: `items.filter(x => x.active).map(x => x.id).forEach(id => { ids.push(id); });`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：性能\n\n## 问题描述\nfilter + map 可链式合并；若只为收集 id，reduce 或单次 for 更直观。\n\n## 建议修改\n\`const ids = items.filter(x => x.active).map(x => x.id);\` 避免无意义 forEach 再 push。`,
  },
  // ── 错误处理 / 可靠性 ──
  {
    code: `try { await doWork(); } catch (e) {}`,
    review: `## 审查结果\n- 严重程度：高\n- 类别：错误处理\n\n## 问题描述\n空 catch 吞掉所有错误，问题难以排查且可能掩盖数据不一致。\n\n## 建议修改\n至少打日志/上报，或 rethrow；仅在明确可安全忽略的场景缩小捕获范围。`,
  },
  {
    code: `const p = fetch('/api');\nreturn p;`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：错误处理\n\n## 问题描述\n对 fetch Promise 未 await 或未 return，调用方可能拿到未 settled 的 Promise 或行为不符合预期。\n\n## 建议修改\n\`return await fetch('/api');\` 并配合 try/catch 处理网络错误。`,
  },
  {
    code: `if (result != null) {\n  return result.data;\n}\nreturn null;`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：错误处理\n\n## 问题描述\n使用 \`!= null\` 同时过滤 null/undefined 可行，但团队需统一风格与注释。\n\n## 建议修改\n可写为 \`result?.data ?? null\` 提高可读性（需确认 TS/运行环境支持）。`,
  },
  {
    code: `process.on('unhandledRejection', () => {});`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：错误处理\n\n## 问题描述\n空处理 unhandledRejection 会隐藏异步错误，生产环境风险高。\n\n## 建议修改\n记录日志、健康检查告警；仅在测试环境静默。`,
  },
  // ── 可读性 / 最佳实践 ──
  {
    code: `if (a === 1) { doX(); } else if (a === 2) { doY(); } else if (a === 3) { doZ(); }`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：最佳实践\n\n## 问题描述\n长 if-else 链可用映射表或策略模式表达，减少分支维护成本。\n\n## 建议修改\n\`const handlers = { 1: doX, 2: doY, 3: doZ }; handlers[a]?.()\``,
  },
  {
    code: `const STATUS_OK = 200;`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：最佳实践\n\n## 问题描述\n单独常量无问题；若全文件充满魔法数，应集中常量化。\n\n## 建议修改\n与团队约定：业务状态码/错误码放在 \`constants.ts\` 或枚举中统一管理。`,
  },
  {
    code: `function f(a: any, b: any) {\n  return a + b;\n}`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：最佳实践\n\n## 问题描述\n双 any 放弃类型检查，失去 TypeScript 主要价值。\n\n## 建议修改\n为参数提供具体类型或泛型约束，根据语义定义联合类型。`,
  },
  {
    code: `// TODO: fix this\nexport function parse(s: string) { return s.split(','); }`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：可读性\n\n## 问题描述\n无上下文的 TODO 会永远留在代码里；split 对边界情况可能不足。\n\n## 建议修改\n创建 issue 并链接 TODO，或补全空字符串/转义/trim 等约定。`,
  },
  {
    code: `Object.keys(obj).forEach(k => { delete obj[k]; });`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：最佳实践\n\n## 问题描述\n边遍历边删键在某些引擎上行为易混；清对象可用更清晰写法。\n\n## 建议修改\n\`for (const k of Object.keys(obj)) delete obj[k]\` 或 \`Object.assign(obj, {})\` 等明确清空策略。`,
  },
  {
    code: `useMemo(() => expensive(arr), [arr]);`,
    review: `## 审查结果\n- 严重程度：低\n- 类别：最佳实践\n\n## 问题描述\n若 \`arr\` 是每次 render 新数组，依赖不变性失效，useMemo 总重算。\n\n## 建议修改\n稳定引用（useState 保存、或子项 id 作依赖、或上提数据形态）。`,
  },
  {
    code: `document.getElementById('btn').addEventListener('click', () => { submit(); });`,
    review: `## 审查结果\n- 严重程度：中\n- 类别：错误处理\n\n## 问题描述\ngetElementById 可能为 null，直接 addEventListener 会运行时异常。\n\n## 建议修改\n空值检查：\`const el = document.getElementById('btn'); if (el) el.addEventListener(...)\``,
  },
];

// ============================================================
// 第三步：数据清洗与验证
// ============================================================

/**
 * 将原始样本转换为 OpenAI Fine-tuning JSONL 格式
 */
function toFinetuneSample(item: { code: string; review: string }): FinetuneSample {
  return {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `请审查以下代码：\n\n\`\`\`\n${item.code}\n\`\`\`` },
      { role: "assistant", content: item.review },
    ],
  };
}

interface ValidationResult {
  total: number;
  valid: number;
  issues: Array<{ index: number; issue: string }>;
  tokenStats: { min: number; max: number; avg: number; total: number };
}

/**
 * 数据质量验证
 *
 * OpenAI Fine-tuning 的要求：
 *   - 每条数据必须有 messages 数组
 *   - messages 中必须有 assistant 角色的消息
 *   - 建议每条数据的 token 数不超过 4096
 *   - 至少 10 条数据（推荐 50-100 条）
 */
function validateDataset(samples: FinetuneSample[]): ValidationResult {
  const issues: ValidationResult["issues"] = [];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;

    if (!Array.isArray(s.messages) || s.messages.length === 0) {
      issues.push({ index: i, issue: "messages 为空" });
      continue;
    }

    const hasSystem = s.messages.some((m) => m.role === "system");
    const hasUser = s.messages.some((m) => m.role === "user");
    const hasAssistant = s.messages.some((m) => m.role === "assistant");

    if (!hasSystem) issues.push({ index: i, issue: "缺少 system 消息" });
    if (!hasUser) issues.push({ index: i, issue: "缺少 user 消息" });
    if (!hasAssistant) issues.push({ index: i, issue: "缺少 assistant 消息" });

    // 粗略估算 token 数（中文 ~1.5 token/字，英文 ~0.25 token/字）
    const totalChars = s.messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars > 8000) {
      issues.push({ index: i, issue: `内容过长 (${totalChars} 字符)` });
    }
    if (totalChars < 20) {
      issues.push({ index: i, issue: `内容过短 (${totalChars} 字符)` });
    }
  }

  const charCounts = samples.map((s) =>
    s.messages.reduce((sum, m) => sum + m.content.length, 0)
  );
  const estimatedTokens = charCounts.map((c) => Math.ceil(c * 0.5));

  return {
    total: samples.length,
    valid: samples.length - new Set(issues.map((i) => i.index)).size,
    issues,
    tokenStats: {
      min: Math.min(...estimatedTokens),
      max: Math.max(...estimatedTokens),
      avg: Math.round(estimatedTokens.reduce((a, b) => a + b, 0) / estimatedTokens.length),
      total: estimatedTokens.reduce((a, b) => a + b, 0),
    },
  };
}

/**
 * 拆分训练集和验证集（80/20）
 */
function splitDataset(samples: FinetuneSample[], validRatio = 0.2) {
  const shuffled = [...samples].sort(() => Math.random() - 0.5);
  const splitIdx = Math.floor(shuffled.length * (1 - validRatio));
  return {
    train: shuffled.slice(0, splitIdx),
    valid: shuffled.slice(splitIdx),
  };
}

/**
 * 写入 JSONL 文件
 */
function writeJsonl(filepath: string, samples: FinetuneSample[]) {
  const content = samples.map((s) => JSON.stringify(s)).join("\n") + "\n";
  writeFileSync(filepath, content, "utf-8");
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log("📦 Fine-tuning 实战 Part 1: 数据集准备\n");
  console.log(`场景: 代码审查助手 | 样本数: ${SAMPLES.length}\n`);

  // 1. 转换格式
  printSection("步骤 1: 转换为 JSONL 格式");
  const allSamples = SAMPLES.map(toFinetuneSample);
  printStep("data", `共 ${allSamples.length} 条样本`);
  printStep("data", `示例:\n${JSON.stringify(allSamples[0], null, 2).slice(0, 300)}...`);

  // 2. 数据验证
  printSection("步骤 2: 数据质量验证");
  const validation = validateDataset(allSamples);
  printStep("result", `总数: ${validation.total} | 有效: ${validation.valid}`);
  printStep("result", `Token 估算: min=${validation.tokenStats.min}, max=${validation.tokenStats.max}, avg=${validation.tokenStats.avg}, total=${validation.tokenStats.total}`);

  if (validation.issues.length > 0) {
    printStep("warn", `发现 ${validation.issues.length} 个问题:`);
    for (const issue of validation.issues.slice(0, 5)) {
      console.log(`  [#${issue.index}] ${issue.issue}`);
    }
  } else {
    printStep("result", "✅ 所有样本通过验证");
  }

  // 3. 拆分数据集
  printSection("步骤 3: 拆分训练集/验证集");
  const { train, valid } = splitDataset(allSamples);
  printStep("data", `训练集: ${train.length} 条 | 验证集: ${valid.length} 条`);

  // 4. 输出文件
  printSection("步骤 4: 写入 JSONL 文件");
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const trainPath = resolve(DATA_DIR, "train.jsonl");
  const validPath = resolve(DATA_DIR, "valid.jsonl");
  const allPath = resolve(DATA_DIR, "all.jsonl");

  writeJsonl(trainPath, train);
  writeJsonl(validPath, valid);
  writeJsonl(allPath, allSamples);

  printStep("result", `✅ 文件已写入:`);
  console.log(`  训练集: ${trainPath}`);
  console.log(`  验证集: ${validPath}`);
  console.log(`  完整集: ${allPath}`);

  // 5. 预估微调成本
  printSection("步骤 5: 成本预估");
  const estimatedTokensTotal = validation.tokenStats.total;
  const epochs = 3;
  const trainingTokens = estimatedTokensTotal * epochs;
  const costPer1kTokens = 0.008; // gpt-4o-mini fine-tuning 价格（2024 年参考）
  const estimatedCost = (trainingTokens / 1000) * costPer1kTokens;

  printStep("cost", `训练 Token: ~${trainingTokens.toLocaleString()} (${epochs} epochs)`);
  printStep("cost", `预估费用: ~$${estimatedCost.toFixed(2)} (gpt-4o-mini 参考价)`);
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
