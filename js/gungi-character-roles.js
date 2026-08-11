(() => {
  'use strict';

  /**
   * 軍議マスター：キャラクター役割・質問振り分け共通設定
   *
   * 基準資料：
   * - 03_キャラクター共通設定.md
   * - 04_ミナ設定.md
   * - 05_ハル設定.md
   * - 06_リク設定.md
   * - 07_レン設定.md
   * - 08_キャラクター識別表.md
   *
   * 現段階の軍議メイン話者はミナとリク。
   * ハルとレンは将来拡張用として役割だけ保持し、質問自動振り分けには参加させない。
   */

  const QUESTION_TYPES = Object.freeze({
    SOFT: 'soft',
    ANALYSIS: 'analysis',
    DECISION: 'decision',
    RISK: 'risk',
    FOLLOW_UP: 'follow_up'
  });

  const characters = Object.freeze({
    mina: Object.freeze({
      id: 'mina',
      name: 'ミナ',
      enabledForGungi: true,
      baseRole: '場を動かす人',
      axis: 'ひらめきと行動力',
      gungiRole: '入口・聞き役・話しやすい進行',
      primaryQuestionTypes: Object.freeze([
        QUESTION_TYPES.SOFT,
        QUESTION_TYPES.FOLLOW_UP
      ]),
      secondaryQuestionTypes: Object.freeze([
        QUESTION_TYPES.ANALYSIS
      ]),
      strengths: Object.freeze([
        'アイデア出し',
        '場の空気を明るくする',
        '参加者が楽しめる企画を考える',
        '誰も動けない時に最初に動く'
      ]),
      cautionAreas: Object.freeze([
        'ルール確認',
        '期限や担当の整理',
        '企画の安全面チェック',
        '一度立ち止まること'
      ]),
      speakingStyle: Object.freeze([
        '明るく柔らかい',
        '短く答えやすい質問を優先する',
        '設計者の思いや参加者目線を引き出す',
        '否定から入らない',
        '専門用語を必要以上に使わない'
      ])
    }),

    riku: Object.freeze({
      id: 'riku',
      name: 'リク',
      enabledForGungi: true,
      baseRole: '確認役',
      axis: 'ルール、事実、リスク管理',
      gungiRole: '分析・深掘り・重要判断',
      primaryQuestionTypes: Object.freeze([
        QUESTION_TYPES.DECISION,
        QUESTION_TYPES.RISK
      ]),
      secondaryQuestionTypes: Object.freeze([
        QUESTION_TYPES.ANALYSIS
      ]),
      strengths: Object.freeze([
        'ルール確認',
        '危険箇所の洗い出し',
        '担当と期限の整理',
        '「決定」と「案」を分ける',
        '過去事例やガイドラインの確認'
      ]),
      cautionAreas: Object.freeze([
        '自由なひらめきだけの時間',
        '感情で盛り上がっている場に入ること',
        '注意の言い方を柔らかくすること'
      ]),
      speakingStyle: Object.freeze([
        '落ち着いて論理的に話す',
        '質問の意図を明確にする',
        '理由・根拠・事実確認を重視する',
        '案を潰すのではなく実現可能な形へ整える',
        '厳しくなりすぎず、分からないまま決めない'
      ])
    }),

    haru: Object.freeze({
      id: 'haru',
      name: 'ハル',
      enabledForGungi: false,
      baseRole: '読者目線の主人公',
      axis: '聞いて、考えて、成長する',
      futureRole: '初心者視点の疑問・理解確認'
    }),

    ren: Object.freeze({
      id: 'ren',
      name: 'レン',
      enabledForGungi: false,
      baseRole: '全体を見る人',
      axis: '受け止めて、道を示す',
      futureRole: '議論の整理・合意形成・次の行動への橋渡し'
    })
  });

  const routing = Object.freeze({
    [QUESTION_TYPES.SOFT]: 'mina',
    [QUESTION_TYPES.FOLLOW_UP]: 'mina',
    [QUESTION_TYPES.DECISION]: 'riku',
    [QUESTION_TYPES.RISK]: 'riku',
    [QUESTION_TYPES.ANALYSIS]: 'context',
    fallback: 'mina',

    analysisHints: Object.freeze({
      mina: Object.freeze([
        '設計者の思い',
        '参加者目線',
        '体験',
        '雰囲気',
        '楽しさ',
        '話しやすい確認'
      ]),
      riku: Object.freeze([
        'ルール',
        '事実',
        '根拠',
        '危険',
        'リスク',
        '配置',
        '距離',
        '矛盾',
        '重要判断'
      ])
    })
  });

  const principles = Object.freeze([
    '誰か一人だけが正しい構図にしない',
    '意見が違う時も相手を攻撃する方向にしない',
    '注意する場面でも相手の意図を受け止める',
    'ルールは縛るためではなく参加者を守るために扱う',
    '失敗を笑いにしても人物を馬鹿にしない',
    '最後は次の行動へ進める形にする'
  ]);

  window.GUNGI_CHARACTER_ROLES = Object.freeze({
    version: 1,
    questionTypes: QUESTION_TYPES,
    activeSpeakers: Object.freeze(['mina', 'riku']),
    futureSpeakers: Object.freeze(['haru', 'ren']),
    characters,
    routing,
    principles
  });
})();
