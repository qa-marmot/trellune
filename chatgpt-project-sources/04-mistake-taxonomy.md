# Mistake taxonomy

JSONの `mistakes[].category` は次だけを使用します。

| 値                      | 用途                                   |
| ----------------------- | -------------------------------------- |
| `grammar_tense`         | 時制・動詞形                           |
| `grammar_word_order`    | 語順・疑問文                           |
| `grammar_agreement`     | 主語と動詞の一致、単複                 |
| `grammar_article`       | a/an/the/無冠詞                        |
| `grammar_preposition`   | 前置詞                                 |
| `vocabulary_choice`     | 語の意味・選択                         |
| `phrase_naturalness`    | 意味は通るが定型性・自然さに課題       |
| `pronunciation_segment` | 個別音                                 |
| `pronunciation_stress`  | 語強勢                                 |
| `pronunciation_rhythm`  | 文強勢・リズム・つながり               |
| `listening`             | 聞き取り                               |
| `interaction`           | 聞き返し、追加質問、順番管理           |
| `other`                 | 上記に入らないもの。説明に具体名を記す |

`severity` は、意味がほぼ通じるなら `low`、理解に努力が必要なら `medium`、意味が変わる・会話が止まるなら `high` とします。同じ発話に複数の問題がある場合も、学習価値の高い分類だけを記録して過剰採点を避けます。
