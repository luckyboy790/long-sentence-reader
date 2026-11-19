const sampleSentences = [
  {
    "year": "2026",
    "group": "英语一",
    "num": 1,
    "src": "原创例句 · 英语一练习",
    "section": "原创例句",
    "text": "What surprised the librarian was that the shelf she had almost removed became the busiest corner of the room.",
    "subj": [
      "What surprised the librarian"
    ],
    "pred": [
      "was"
    ],
    "trunk": [
      "What surprised the librarian",
      "was that the shelf",
      "became the busiest corner of the room"
    ],
    "trans": "让图书管理员惊讶的是，那排她差点撤掉的书架竟成了阅览室里最热闹的角落。",
    "coreNote": "What 引导的整句作主语，was 后跟表语从句。表语从句又在主语 shelf 后嵌入了一层修饰。",
    "steps": [
      {
        "type": "noun",
        "label": "主语从句",
        "span": "What surprised the librarian",
        "head": "What",
        "anchor": "was",
        "note": "What 既引导主语从句，也在从句里作 surprised 的主语，指让管理员意外的事。"
      },
      {
        "type": "noun",
        "label": "表语从句",
        "span": "that the shelf she had almost removed became the busiest corner of the room",
        "head": "that",
        "anchor": "was",
        "note": "that 后面的内容解释了究竟是什么事情让她惊讶。"
      },
      {
        "type": "attr",
        "label": "定语从句",
        "span": "she had almost removed",
        "head": "",
        "anchor": "shelf",
        "note": "removed 后缺宾语；把 shelf 放回这个位置，就能看出这个从句修饰哪一个名词。"
      }
    ],
    "phrases": [
      [
        "surprised the librarian",
        "让图书管理员感到惊讶"
      ],
      [
        "the busiest corner",
        "最热闹的角落"
      ]
    ]
  },
  {
    "year": "2026",
    "group": "英语二",
    "num": 1,
    "src": "原创例句 · 英语二练习",
    "section": "原创例句",
    "text": "Although each extra stop added only a minute to the journey, the driver changed the route so that the last bus could reach the station before midnight.",
    "subj": [
      "the driver"
    ],
    "pred": [
      "changed"
    ],
    "trunk": [
      "the driver changed the route"
    ],
    "trans": "虽然每多停一站只会让行程延长一分钟，司机还是改了路线，以便末班车能在午夜前抵达车站。",
    "coreNote": "跳过 Although 引出的让步条件，再问谁做了什么，答案是司机改了路线。",
    "steps": [
      {
        "type": "adv",
        "label": "让步状语从句",
        "span": "Although each extra stop added only a minute to the journey",
        "head": "Although",
        "anchor": "changed",
        "note": "虽然每一站增加的时间很短，司机仍然决定改线。"
      },
      {
        "type": "adv",
        "label": "目的状语从句",
        "span": "so that the last bus could reach the station before midnight",
        "head": "so that",
        "anchor": "changed",
        "note": "so that 引出改线想实现的目的。"
      }
    ],
    "phrases": [
      [
        "changed the route",
        "改变路线"
      ],
      [
        "before midnight",
        "在午夜前"
      ]
    ]
  },
  {
    "year": "2026",
    "group": "四级",
    "num": 1,
    "src": "原创例句 · 四级练习",
    "section": "原创例句",
    "text": "The note that Mei left on the kitchen table reminded her brother to water the beans.",
    "subj": [
      "The note"
    ],
    "pred": [
      "reminded"
    ],
    "trunk": [
      "The note",
      "reminded her brother to water the beans"
    ],
    "trans": "小梅留在厨房桌上的便条提醒弟弟给豆苗浇水。",
    "coreNote": "先找到 The note 和 reminded；两者之间的内容说明是哪张便条。",
    "steps": [
      {
        "type": "attr",
        "label": "定语从句",
        "span": "that Mei left on the kitchen table",
        "head": "that",
        "anchor": "note",
        "note": "that 代替 note，作 left 的宾语。"
      },
      {
        "type": "nonfin",
        "label": "不定式补足语",
        "span": "to water the beans",
        "head": "to",
        "anchor": "her brother",
        "note": "remind somebody to do something 表示提醒某人做某事。浇水的人是弟弟。"
      }
    ],
    "phrases": [
      [
        "on the kitchen table",
        "在厨房桌上"
      ],
      [
        "water the beans",
        "给豆苗浇水"
      ]
    ]
  },
  {
    "year": "2026",
    "group": "六级",
    "num": 1,
    "src": "原创例句 · 六级练习",
    "section": "原创例句",
    "text": "By comparing two maps drawn a century apart, the students discovered where the narrow stream had once crossed their campus.",
    "subj": [
      "the students"
    ],
    "pred": [
      "discovered"
    ],
    "trunk": [
      "the students discovered where the narrow stream had once crossed their campus"
    ],
    "trans": "学生们通过比对两张绘制时间相隔一个世纪的地图，发现了那条小溪曾经从校园的什么地方流过。",
    "coreNote": "discovered 的宾语是一个由 where 引导的完整从句，句首的介词短语交代发现的方式。",
    "steps": [
      {
        "type": "phrase",
        "label": "方式状语",
        "span": "By comparing two maps drawn a century apart",
        "head": "By",
        "anchor": "discovered",
        "note": "by 后接动名词短语，交代学生们用了什么方法。"
      },
      {
        "type": "nonfin",
        "label": "过去分词短语",
        "span": "drawn a century apart",
        "head": "drawn",
        "anchor": "maps",
        "note": "drawn 修饰 maps，地图是被绘制的；a century apart 指两次绘制相隔一个世纪。"
      },
      {
        "type": "noun",
        "label": "宾语从句",
        "span": "where the narrow stream had once crossed their campus",
        "head": "where",
        "anchor": "discovered",
        "note": "where 引出发现的具体内容，在从句中作地点状语。"
      }
    ],
    "phrases": [
      [
        "a century apart",
        "相隔一个世纪"
      ],
      [
        "had once crossed",
        "曾经穿过"
      ]
    ]
  }
];
