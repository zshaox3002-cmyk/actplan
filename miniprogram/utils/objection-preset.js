/**
 * objection-preset.js — 系统预置异议数据
 * 包含保险行业最常见的 6 类异议及标准四步应对话术
 */

var PRESET_OBJECTIONS = [
  {
    id: 'preset_price_01',
    title: '太贵了，我买不起',
    content: '太贵了，我买不起 / 别家的便宜多了',
    category: '价格',
    isPreset: true,
    isOfficial: true,
    occurrenceCount: 0,
    script: {
      step1_affirm: '完全理解您的感受，现在大家花钱确实都要精打细算。',
      step2_clarify: '您说的"贵"，是跟什么比呢？是觉得保费超出预算了，还是觉得同样的保障其他家更便宜？',
      step3_response: '其实保险不是消费，而是把未来可能发生的风险转移出去。每年交的钱不多，但万一出事能拿到几十万的理赔金。而且保费是按年龄递增的，现在买是最划算的时机。',
      step4_confirm: '要不我们先按一个您能接受的预算来配置方案？比如先保核心风险，后续有条件再加保。您觉得这个思路怎么样？'
    }
  },
  {
    id: 'preset_timing_02',
    title: '再等等，以后再说吧',
    content: '再等等 / 以后再说吧 / 我再考虑考虑',
    category: '时机',
    isPreset: true,
    isOfficial: true,
    occurrenceCount: 0,
    script: {
      step1_affirm: '没问题，买保险确实是大事，谨慎考虑是对的。',
      step2_clarify: '想了解一下，您主要在顾虑哪方面呢？是对产品还不了解，还是在等某个时间点？',
      step3_response: '有一件事需要提醒您：保险不是想买就能买的。它需要健康审核，年龄越大、身体越差，可能被拒保或加费。现在的身体状况就是最好的投保时机，等一等可能就买不了了。',
      step4_confirm: '要不这样，我先帮您做一个免费的健康评估，看看目前能不能顺利通过核保？反正不收费，您了解一下也不吃亏。'
    }
  },
  {
    id: 'preset_necessity_03',
    title: '我有社保/公司给买了，不需要',
    content: '我有社保 / 公司给买了商业险 / 不需要重复买',
    category: '必要性',
    isPreset: true,
    isOfficial: true,
    occurrenceCount: 0,
    script: {
      step1_affirm: '您有社保意识很好，这已经是很多人没有的保障基础了。',
      step2_clarify: '那您知道社保和商业险的区别吗？社保报销有封顶线，很多进口药、特效药是不报的。',
      step3_response: '打个比方：社保像医保卡里的余额，用完就没有了；商业险像一张不限额的通行证，大额医疗费用都能兜底。而且社保不赔身故/伤残，这些恰恰是一个家庭最大的经济打击来源。',
      step4_confirm: '我可以给您看一个对比表，社保能报多少 vs 加上商业险后能报多少，一目了然。要不要花两分钟看一下？'
    }
  },
  {
    id: 'preset_compare_04',
    title: '别家公司产品更好/更便宜',
    content: '别家公司的产品更好 / 别家便宜多了 / 我朋友推荐了另一款',
    category: '产品对比',
    isPreset: true,
    isOfficial: true,
    occurrenceCount: 0,
    script: {
      step1_affirm: '货比三家是聪明做法，我支持您多了解。',
      step2_clarify: '您比较的那款产品，具体哪些方面吸引您呢？是价格还是保障范围？',
      step3_response: '每款产品都有它的设计定位和目标人群，没有绝对的"最好"只有"最适合"。有些产品便宜但免责条款多，有些看着全但理赔门槛高。关键是要看条款细节而不是只比价格。',
      step4_confirm: '要不我们坐下来做个详细的产品条款拆解对比？我把您关注的那款和我们这款放一起逐条分析，帮您做出真正知情的选择。'
    }
  },
  {
    id: 'preset_trust_05',
    title: '我不相信保险公司/怕被骗',
    content: '保险公司都是骗人的 / 我不信这个 / 怕理赔时扯皮',
    category: '信任',
    isPreset: true,
    isOfficial: true,
    occurrenceCount: 0,
    script: {
      step1_affirm: '您的担心我非常理解，毕竟保险合同一签就是几十年，信任很重要。',
      step2_clarify: '您说"不相信"，是之前有过不好的经历吗？还是听说了某些负面消息？',
      step3_response: '首先，保险公司受银保监会严格监管，合同具有法律效力，不会因为公司意愿拒赔。其次，理赔是否顺利关键在于投保时是否如实告知健康状况、条款是否理解清楚。我的职责就是帮您把这些都做对，确保将来该赔的一分不少。',
      step4_confirm: '您可以先从小额的、短期的产品开始体验，建立信任后再逐步加保。我建议先从一份百万医疗险开始，一年几百块，先试试服务流程。'
    }
  },
  {
    id: 'preset_family_06',
    title: '要和家人商量一下',
    content: '我得回去问问家人 / 老婆/老公不同意 / 家里人觉得没必要',
    category: '信任',
    isPreset: true,
    isOfficial: true,
    occurrenceCount: 0,
    script: {
      step1_affirm: '涉及家庭财务的大事，和家人商量是非常负责任的做法。',
      step2_clarify: '您家人主要是担心哪方面呢？是觉得没必要花钱，还是对这个产品不了解？',
      step3_response: '很多时候家人的反对是因为信息不对称——他们不知道保险真正解决的是什么问题。如果您愿意的话，我可以准备一份简明的家庭保障方案说明，用大白话讲清楚这份保险到底保什么、为什么重要、多少钱，方便您带回家和家人讨论。',
      step4_confirm: '要不我现在就帮您整理一份家庭版说明书？或者方便的话约个时间，我和您家里人一起聊聊，有什么疑虑当场解答。'
    }
  }
];

module.exports = { PRESET_OBJECTIONS };
