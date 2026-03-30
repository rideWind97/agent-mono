/**
 * Prompt Playground — 类型定义与预设策略
 *
 * 实践任务：
 * 1. 设计一个"代码审查助手"的 System Prompt
 * 2. 用 Few-shot 让模型输出固定 JSON 格式
 * 3. 实现 CoT 提示，让模型分步解决数学题
 * 4. 对比不同 Prompt 策略的输出质量
 */

export type Provider = "openai" | "gemini";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Prompt 策略类型 */
export type PromptStrategy =
  | "code-review"
  | "few-shot-json"
  | "cot-math"
  | "comparison";

/** 策略预设配置 */
export interface StrategyPreset {
  id: PromptStrategy;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
  /** Few-shot 示例消息（可选） */
  fewShotMessages?: Message[];
  /** 预设的用户输入建议 */
  suggestions: string[];
  /** 策略说明（Markdown） */
  explanation: string;
}

// ============================================================
// 1. 代码审查助手 System Prompt
// ============================================================
const CODE_REVIEW_SYSTEM_PROMPT = `你是一位资深的代码审查助手（Code Review Assistant）。你的职责是对用户提交的代码进行专业、全面的审查。

## 审查维度

请从以下维度进行审查，并给出具体建议：

1. **代码质量** — 可读性、命名规范、代码结构
2. **潜在 Bug** — 逻辑错误、边界条件、空值处理
3. **性能问题** — 不必要的计算、内存泄漏、算法复杂度
4. **安全隐患** — XSS、注入攻击、敏感信息泄露
5. **最佳实践** — 设计模式、SOLID 原则、框架惯用写法

## 输出格式

请按以下结构输出审查结果：

### 📊 总体评分：X/10

### 🔍 审查详情

对每个发现的问题，使用以下格式：

- **[严重程度: 高/中/低]** 问题描述
  - 📍 位置：具体代码行或函数
  - 💡 建议：改进方案
  - 📝 示例：修改后的代码（如适用）

### ✅ 优点
列出代码中做得好的地方。

### 📋 改进建议总结
按优先级列出需要改进的事项。

## 注意事项
- 保持客观专业的语气
- 给出具体可操作的建议，而非笼统的评价
- 如果代码质量很好，也要给予肯定
- 考虑代码的上下文和使用场景`;

// ============================================================
// 2. Few-shot JSON 输出
// ============================================================
const FEW_SHOT_JSON_SYSTEM_PROMPT = `你是一个结构化数据提取助手。你的任务是从用户提供的自然语言文本中提取关键信息，并以严格的 JSON 格式输出。

## 输出要求
- 只输出 JSON，不要包含任何其他文字、解释或 markdown 代码块标记
- JSON 必须是合法的，可以被 JSON.parse() 直接解析
- 所有字段都必须存在，缺失信息用 null 填充
- 日期格式统一为 YYYY-MM-DD
- 数值类型不要加引号`;

const FEW_SHOT_MESSAGES: Message[] = [
  {
    role: "user",
    content:
      "帮我分析这段文本：张三，男，1990年3月15日出生，在北京字节跳动工作，担任高级前端工程师，年薪50万。",
  },
  {
    role: "assistant",
    content: JSON.stringify(
      {
        name: "张三",
        gender: "男",
        birthDate: "1990-03-15",
        age: 36,
        location: "北京",
        company: "字节跳动",
        position: "高级前端工程师",
        salary: { amount: 500000, currency: "CNY", period: "yearly" },
        skills: null,
        education: null,
      },
      null,
      2,
    ),
  },
  {
    role: "user",
    content:
      "李四是一位来自上海的产品经理，在阿里巴巴工作了5年，月薪3万5，毕业于浙江大学计算机专业。",
  },
  {
    role: "assistant",
    content: JSON.stringify(
      {
        name: "李四",
        gender: null,
        birthDate: null,
        age: null,
        location: "上海",
        company: "阿里巴巴",
        position: "产品经理",
        salary: { amount: 35000, currency: "CNY", period: "monthly" },
        skills: null,
        education: {
          university: "浙江大学",
          major: "计算机",
          degree: null,
        },
      },
      null,
      2,
    ),
  },
];

// ============================================================
// 3. CoT 数学推理
// ============================================================
const COT_MATH_SYSTEM_PROMPT = `你是一位数学解题专家。请使用 Chain-of-Thought（思维链）方法，一步一步地解决用户提出的数学问题。

## 解题要求

1. **理解题意**：首先复述题目，确认理解正确
2. **分步推理**：将解题过程拆分为清晰的步骤，每步都要有明确的推理过程
3. **显示计算**：每一步的计算过程都要写出来，不要跳步
4. **验证答案**：解完后进行验证，确保答案正确
5. **总结**：最后用一句话给出最终答案

## 输出格式

### 📖 题目理解
[复述题目]

### 🧮 分步求解

**第 1 步：[步骤描述]**
[详细推理和计算过程]

**第 2 步：[步骤描述]**
[详细推理和计算过程]

...（根据需要添加更多步骤）

### ✅ 验证
[验证过程]

### 🎯 最终答案
[简洁的最终答案]

## 注意事项
- 即使是简单的问题，也要展示完整的推理过程
- 使用清晰的数学符号
- 如果有多种解法，选择最直观易懂的方法
- 如果题目有歧义，指出并给出不同理解下的答案`;

// ============================================================
// 4. 对比用的 Zero-shot（基准策略）
// ============================================================
const ZERO_SHOT_SYSTEM_PROMPT =
  "你是一个 AI 助手，请回答用户的问题。";

// ============================================================
// 策略预设集合
// ============================================================
export const STRATEGY_PRESETS: Record<PromptStrategy, StrategyPreset> = {
  "code-review": {
    id: "code-review",
    name: "代码审查助手",
    icon: "🔍",
    description: "专业的 System Prompt 设计，让 AI 像资深工程师一样审查代码",
    systemPrompt: CODE_REVIEW_SYSTEM_PROMPT,
    suggestions: [
      `请审查以下 React 组件：

function UserList({ users }) {
  const [search, setSearch] = useState('')
  
  const filtered = users.filter(u => 
    u.name.includes(search)
  )
  
  return (
    <div>
      <input onChange={e => setSearch(e.target.value)} />
      {filtered.map(user => (
        <div onClick={() => window.location.href = '/user/' + user.id}>
          <img src={user.avatar} />
          <span>{user.name}</span>
          <span dangerouslySetInnerHTML={{__html: user.bio}} />
        </div>
      ))}
    </div>
  )
}`,
      `审查这段 Node.js API 代码：

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body
  const user = await db.query(
    'SELECT * FROM users WHERE username = "' + username + '"'
  )
  if (user && user.password === password) {
    const token = jwt.sign({ id: user.id }, 'secret123')
    res.json({ token })
  } else {
    res.status(401).json({ error: 'Invalid credentials' })
  }
})`,
      `审查这个 TypeScript 工具函数：

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function debounce(fn: Function, delay: number) {
  let timer: any
  return function(...args: any[]) {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}`,
    ],
    explanation: `## System Prompt 设计要点

**这个 System Prompt 展示了以下 Prompt Engineering 技巧：**

1. **角色设定（Role Prompting）**：明确 AI 的身份是"资深代码审查助手"
2. **结构化输出**：定义了清晰的审查维度和输出格式
3. **评分体系**：要求给出量化评分，便于对比
4. **严重程度分级**：高/中/低三级，帮助开发者优先处理
5. **正面反馈**：不只指出问题，也肯定优点
6. **约束条件**：明确注意事项，避免模型产生不当输出`,
  },

  "few-shot-json": {
    id: "few-shot-json",
    name: "Few-shot JSON 提取",
    icon: "📋",
    description: "通过示例教会模型输出固定格式的 JSON 结构化数据",
    systemPrompt: FEW_SHOT_JSON_SYSTEM_PROMPT,
    fewShotMessages: FEW_SHOT_MESSAGES,
    suggestions: [
      "王五，女，1995年出生，在深圳腾讯做UI设计师，月薪2万8，精通Figma和Sketch。",
      "赵六是杭州网易的后端开发，本科毕业于清华大学软件工程专业，1988年6月出生，年薪80万，擅长Java和Go语言。",
      "小明今年28岁，在成都的一家创业公司当CTO，公司主要做AI应用开发，他之前在美团工作过3年。",
    ],
    explanation: `## Few-shot Prompting 设计要点

**这个策略展示了 Few-shot 的核心技巧：**

1. **System Prompt 定义规则**：明确输出要求（纯 JSON、字段规范）
2. **示例覆盖多种情况**：
   - 示例 1：信息完整的情况
   - 示例 2：部分信息缺失（用 null 填充）
3. **格式一致性**：两个示例的 JSON 结构完全一致
4. **隐式教学**：通过示例让模型学会：
   - 日期格式转换（"1990年3月15日" → "1990-03-15"）
   - 年龄自动计算
   - 薪资结构化（区分月薪/年薪）
   - 缺失信息处理（null 而非空字符串）

**对比 Zero-shot**：不给示例时，模型可能输出不一致的格式、遗漏字段、或添加多余的解释文字。`,
  },

  "cot-math": {
    id: "cot-math",
    name: "CoT 数学推理",
    icon: "🧮",
    description: "使用思维链（Chain-of-Thought）让模型分步解决数学问题",
    systemPrompt: COT_MATH_SYSTEM_PROMPT,
    suggestions: [
      "一个水池有两个进水管和一个排水管。单独开进水管A，6小时可以注满水池；单独开进水管B，8小时可以注满水池；单独开排水管，12小时可以排空水池。如果三个管同时打开，多少小时可以注满水池？",
      "小明有一些糖果，他先给了小红总数的1/3，然后又给了小华剩下的1/4，最后还剩下24颗。小明原来有多少颗糖果？",
      "一列火车通过一座长300米的桥需要40秒，通过一个长100米的隧道需要25秒。求火车的速度和车身长度。",
    ],
    explanation: `## Chain-of-Thought (CoT) 设计要点

**这个策略展示了 CoT 的核心技巧：**

1. **明确要求分步推理**：System Prompt 中要求"一步一步"解题
2. **结构化步骤**：定义了"理解 → 分步 → 验证 → 总结"的流程
3. **不允许跳步**：要求显示每一步的计算过程
4. **验证环节**：解完后回代验证，减少计算错误
5. **格式化输出**：使用 Markdown 格式，清晰展示推理链

**为什么 CoT 有效？**
- 将复杂问题分解为简单子问题
- 每一步的推理为下一步提供上下文
- 减少"跳跃式推理"导致的错误
- 验证环节提供自我纠错机会

**对比 Zero-shot**：不使用 CoT 时，模型可能直接给出答案，中间推理过程不透明，容易出错。`,
  },

  comparison: {
    id: "comparison",
    name: "策略对比实验",
    icon: "⚖️",
    description: "用同一个问题对比 Zero-shot、Few-shot、CoT 的输出质量",
    systemPrompt: ZERO_SHOT_SYSTEM_PROMPT,
    suggestions: [
      "一个商店打折促销：原价200元的商品先打8折，再用满100减20的优惠券，最终价格是多少？",
      "从以下文本中提取人物信息并以JSON格式输出：刘强东，1974年出生于江苏宿迁，京东集团创始人兼CEO。",
      "请审查这段代码有什么问题：\nfunction add(a, b) { return a - b }",
    ],
    explanation: `## 策略对比实验说明

**本实验对比三种 Prompt 策略：**

| 策略 | 特点 | 适用场景 |
|------|------|----------|
| **Zero-shot** | 不给示例，直接提问 | 简单问答、通用任务 |
| **Few-shot** | 提供 2-3 个示例 | 格式化输出、分类任务 |
| **CoT** | 要求分步推理 | 数学、逻辑推理、复杂分析 |

**实验方法：**
1. 输入同一个问题
2. 系统会分别用三种策略发送请求
3. 对比三个输出的质量差异

**观察要点：**
- 输出格式的一致性
- 推理过程的完整性
- 答案的准确性
- 响应的详细程度`,
  },
};

/** 对比模式下的三种策略 */
export const COMPARISON_STRATEGIES = [
  {
    name: "Zero-shot",
    icon: "🎯",
    systemPrompt: ZERO_SHOT_SYSTEM_PROMPT,
    fewShotMessages: [] as Message[],
  },
  {
    name: "Few-shot",
    icon: "📝",
    systemPrompt: FEW_SHOT_JSON_SYSTEM_PROMPT,
    fewShotMessages: FEW_SHOT_MESSAGES,
  },
  {
    name: "CoT",
    icon: "🧠",
    systemPrompt: COT_MATH_SYSTEM_PROMPT,
    fewShotMessages: [] as Message[],
  },
] as const;
