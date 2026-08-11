(() => {
  'use strict';

  /**
   * 軍議マスター：キャラクター役割・質問フロー・距離診断 共通設定
   *
   * キャラクター基準資料：
   * - 03_キャラクター共通設定.md
   * - 04_ミナ設定.md
   * - 05_ハル設定.md
   * - 06_リク設定.md
   * - 07_レン設定.md
   * - 08_キャラクター識別表.md
   *
   * キャンプサイト設計基準：
   * - 「キャンプサイトの作り方 Ver3.5」
   *
   * 現段階の軍議メイン話者はミナとリク。
   * AIによる自由回答解釈は行わず、固定選択肢＋定型リアクションで進行する。
   */

  const QUESTION_TYPES = Object.freeze({
    SOFT: 'soft',
    ANALYSIS: 'analysis',
    DECISION: 'decision',
    RISK: 'risk',
    FOLLOW_UP: 'follow_up',
    TRANSITION: 'transition'
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
      ]),
      defaultReaction: Object.freeze({
        expression: 'normal',
        text: 'OKだよ！'
      })
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
        '質問語尾は「〜している？」「〜になっている？」「〜してある？」を基本にする',
        '厳しくなりすぎず、分からないまま決めない'
      ]),
      defaultReaction: Object.freeze({
        expression: 'agree',
        text: 'なるほど…'
      })
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
    [QUESTION_TYPES.TRANSITION]: 'context',
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

  const interactionPolicy = Object.freeze({
    answerMode: 'fixed_choices_only',
    freeTextAnswerEnabled: false,
    aiInterpretationEnabled: false,
    maxChoicesPerQuestion: 5,
    alwaysReactAfterChoice: true,
    reactionFallbackBySpeaker: Object.freeze({
      mina: 'OKだよ！',
      riku: 'なるほど…'
    }),
    notes: Object.freeze([
      'CAが回答したら、原則として必ずキャラクターが一度リアクションする',
      '専用リアクションがない場合は話者ごとのフォールバックを使う',
      '質問フォーム感を避けるため、区切りでミナとリクの掛け合いを入れる'
    ])
  });

  const questions = Object.freeze([
    Object.freeze({
      id: 'q01',
      speaker: 'mina',
      type: QUESTION_TYPES.SOFT,
      expression: 'normal',
      text: 'このキャンプサイトで、一番大事にしたいのはどれ？',
      choices: Object.freeze([
        Object.freeze({ id: 'gather', label: 'みんなが集まりやすいこと' }),
        Object.freeze({ id: 'walkable', label: '歩きやすいこと' }),
        Object.freeze({ id: 'use_poi', label: 'POIを活かしたい' }),
        Object.freeze({ id: 'discover_local_charm', label: '地域やキャンプサイト周辺の魅力に気づいてほしい' }),
        Object.freeze({ id: 'undecided', label: 'まだ決めてない' })
      ])
    }),

    Object.freeze({
      id: 'q02',
      speaker: 'mina',
      type: QUESTION_TYPES.SOFT,
      expression: 'normal',
      text: 'どんな雰囲気のキャンプサイトにしたい？',
      choices: Object.freeze([
        Object.freeze({ id: 'lively', label: 'にぎやかで交流しやすい' }),
        Object.freeze({ id: 'relaxed', label: 'ゆったり過ごせる' }),
        Object.freeze({ id: 'explore', label: '探検して楽しめる' }),
        Object.freeze({ id: 'variety', label: 'いろんな楽しみ方ができる' }),
        Object.freeze({ id: 'imagining', label: 'まだイメージ中' })
      ])
    }),

    Object.freeze({
      id: 'q03',
      speaker: 'mina',
      type: QUESTION_TYPES.SOFT,
      expression: 'normal',
      text: '参加する人には、どんなふうに楽しんでほしい？',
      choices: Object.freeze([
        Object.freeze({ id: 'free_walk', label: '自由に歩いて楽しんでほしい' }),
        Object.freeze({ id: 'slow_down', label: '時には立ち止まってゆっくりしてほしい' }),
        Object.freeze({ id: 'socialize', label: '仲間と交流しながら楽しんでほしい' }),
        Object.freeze({ id: 'undecided', label: 'まだ決めてない' })
      ]),
      after: 'scene_before_map'
    }),

    Object.freeze({
      id: 'q04',
      speaker: 'riku',
      type: QUESTION_TYPES.RISK,
      expression: 'serious',
      text: 'POIは25個以内に収まっている？',
      choices: Object.freeze([
        Object.freeze({ id: 'yes', label: 'はい' }),
        Object.freeze({ id: 'no', label: 'いいえ' }),
        Object.freeze({ id: 'unchecked', label: 'まだ確認していない' })
      ])
    }),

    Object.freeze({
      id: 'q05',
      speaker: 'riku',
      type: QUESTION_TYPES.RISK,
      expression: 'serious',
      text: 'POIの間隔は40mを基準にしている？',
      choices: Object.freeze([
        Object.freeze({ id: 'yes', label: 'はい' }),
        Object.freeze({ id: 'no', label: 'いいえ' }),
        Object.freeze({ id: 'partial', label: '一部だけ確認した' }),
        Object.freeze({ id: 'unchecked', label: 'まだ確認していない' })
      ]),
      after: 'scene_after_distance_basics'
    }),

    Object.freeze({
      id: 'q06',
      speaker: 'riku',
      type: QUESTION_TYPES.RISK,
      expression: 'serious',
      text: '既存POIと追加POIのレイヤーは分けている？',
      choices: Object.freeze([
        Object.freeze({ id: 'yes', label: 'はい' }),
        Object.freeze({ id: 'no', label: 'いいえ' }),
        Object.freeze({ id: 'unchecked', label: 'まだ確認していない' })
      ])
    }),

    Object.freeze({
      id: 'q07',
      speaker: 'riku',
      type: QUESTION_TYPES.RISK,
      expression: 'serious',
      text: '活動範囲ポリゴンは作ってある？',
      choices: Object.freeze([
        Object.freeze({ id: 'yes', label: 'はい' }),
        Object.freeze({ id: 'no', label: 'いいえ' }),
        Object.freeze({ id: 'unchecked', label: 'まだ確認していない' })
      ])
    }),

    Object.freeze({
      id: 'q08',
      speaker: 'riku',
      type: QUESTION_TYPES.RISK,
      expression: 'serious',
      text: '集合地点は決めてある？',
      choices: Object.freeze([
        Object.freeze({ id: 'yes', label: 'はい' }),
        Object.freeze({ id: 'no', label: 'いいえ' }),
        Object.freeze({ id: 'unchecked', label: 'まだ確認していない' })
      ])
    }),

    Object.freeze({
      id: 'q09',
      speaker: 'riku',
      type: QUESTION_TYPES.FOLLOW_UP,
      expression: 'normal',
      text: '距離チェックは実行してある？',
      choices: Object.freeze([
        Object.freeze({ id: 'what', label: '…え？' }),
        Object.freeze({ id: 'no', label: 'いいえ' }),
        Object.freeze({
          id: 'doing_now',
          label: 'いま、してます',
          reactionScene: 'scene_q09_doing_now'
        })
      ])
    }),

    Object.freeze({
      id: 'q10',
      speaker: 'riku',
      type: QUESTION_TYPES.RISK,
      expression: 'serious',
      text: '現地で、安全に歩けることは確認してある？',
      choices: Object.freeze([
        Object.freeze({ id: 'yes', label: 'はい' }),
        Object.freeze({ id: 'concern', label: '気になる場所がある' }),
        Object.freeze({ id: 'unchecked', label: 'まだ確認していない' })
      ]),
      after: 'scene_before_diagnosis'
    })
  ]);

  const dialogueScenes = Object.freeze({
    scene_before_map: Object.freeze({
      id: 'scene_before_map',
      lines: Object.freeze([
        Object.freeze({ speaker: 'mina', expression: 'happy', text: 'じゃあ、どんなキャンプサイトにしたいかは見えてきたね！' }),
        Object.freeze({ speaker: 'riku', expression: 'serious', text: '次は、実際に提出できる設計になっているか確認しよう。' }),
        Object.freeze({ speaker: 'mina', expression: 'normal', text: '急に現実的。' }),
        Object.freeze({ speaker: 'riku', expression: 'normal', text: '必要だからね。' })
      ]),
      effect: 'signal_cut_then_show_map'
    }),

    scene_after_distance_basics: Object.freeze({
      id: 'scene_after_distance_basics',
      lines: Object.freeze([
        Object.freeze({ speaker: 'mina', expression: 'normal', text: 'いっぱい置けばいいってわけじゃないんだね。' }),
        Object.freeze({ speaker: 'riku', expression: 'agree', text: 'うん。数より、どう配置するかの方が大事だ。' })
      ])
    }),

    scene_q09_doing_now: Object.freeze({
      id: 'scene_q09_doing_now',
      lines: Object.freeze([
        Object.freeze({ speaker: 'mina', expression: 'normal', text: 'リク、今やってるよ。' }),
        Object.freeze({ speaker: 'riku', expression: 'normal', text: '……そうだった。' })
      ])
    }),

    scene_before_diagnosis: Object.freeze({
      id: 'scene_before_diagnosis',
      lines: Object.freeze([
        Object.freeze({ speaker: 'riku', expression: 'agree', text: '確認はこれで一通り終わり。' }),
        Object.freeze({ speaker: 'mina', expression: 'happy', text: 'じゃあ結果を見てみよう！' }),
        Object.freeze({ speaker: 'riku', expression: 'normal', text: '良いところと、もう一度確認したいところを整理する。' })
      ]),
      effect: 'show_diagnosis'
    })
  });

  const submissionRules = Object.freeze({
    poi: Object.freeze({
      totalMax: 25,
      maxByType: Object.freeze({
        pokestop: 12,
        gym: 8,
        powerspot: 5
      })
    }),
    distanceMeters: Object.freeze({
      basic: 40,
      adjustedMinimum: 30
    }),
    requiredChecks: Object.freeze([
      '既存POIと追加POIのレイヤーを分ける',
      '活動範囲ポリゴンを作成する',
      '集合地点を確認する',
      '現地で安全に歩けることを確認する'
    ])
  });

  /**
   * 初版の総合診断は距離チェック連動だけに限定する。
   * Q1〜Q10の回答を点数化したり、キャラクター好感度に変換したりしない。
   * 既存POI同士はCA側で変更できないため診断対象外。
   */
  const distanceDiagnosis = Object.freeze({
    scope: 'distance_only',
    affectionScoreEnabled: false,
    questionScoreEnabled: false,
    ignorePairTypes: Object.freeze(['existing-existing']),
    rules: Object.freeze([
      Object.freeze({
        id: 'ok_40_plus',
        minDistanceInclusive: 40,
        severity: 'none',
        pairTypes: Object.freeze(['existing-added', 'added-added']),
        showInDiagnosis: false,
        action: 'none'
      }),
      Object.freeze({
        id: 'confirm_existing_added_30_40',
        minDistanceInclusive: 30,
        maxDistanceExclusive: 40,
        severity: 'confirm',
        pairTypes: Object.freeze(['existing-added']),
        showInDiagnosis: true,
        speaker: 'riku',
        expression: 'serious',
        message: 'ここは40mを下回っている。30m以上は確保できているけど、この配置で大丈夫か確認しておこう。',
        choices: Object.freeze([
          Object.freeze({ id: 'keep', label: 'このままで問題ない' }),
          Object.freeze({ id: 'review', label: '見直す' })
        ])
      }),
      Object.freeze({
        id: 'block_under_30',
        maxDistanceExclusive: 30,
        severity: 'blocking',
        pairTypes: Object.freeze(['existing-added', 'added-added']),
        showInDiagnosis: true,
        speaker: 'riku',
        expression: 'serious',
        message: 'ここは30m未満になっている。このままでは提出できない。配置を見直そう。',
        submissionAllowed: false,
        action: 'review_required'
      })
    ])
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
    version: 2,
    questionTypes: QUESTION_TYPES,
    activeSpeakers: Object.freeze(['mina', 'riku']),
    futureSpeakers: Object.freeze(['haru', 'ren']),
    characters,
    routing,
    interactionPolicy,
    questions,
    dialogueScenes,
    submissionRules,
    distanceDiagnosis,
    principles
  });
})();
