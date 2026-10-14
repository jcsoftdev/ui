package com.jcsoftdev.ui.chart.testing

/**
 * Decoder for the parity fixtures written by scripts/chart-fixtures.mjs. Shared by every chart module's tests as source
 * (chart-testing/common), so no published artifact and no module edge exists for it.
 *
 * Numbers decode to [Double]. A non-finite number or negative zero is the tagged object {"$f": "NaN" | "Infinity" | "-Infinity" | "-0"},
 * so a plain string "NaN" stays a string. Objects decode to [Map], arrays to [List].
 */
internal object FixtureJson {
    fun parse(text: String): Any? {
        val parser = Parser(text)
        val value = parser.value()
        parser.end()
        return value
    }

    private class Parser(
        private val text: String,
    ) {
        private var at = 0

        fun end() {
            blank()
            require(at == text.length) { "trailing content at $at" }
        }

        fun value(): Any? {
            blank()
            return when (val c = text[at]) {
                '{' -> obj()
                '[' -> list()
                '"' -> string()
                't' -> literal("true", true)
                'f' -> literal("false", false)
                'n' -> literal("null", null)
                else -> if (c == '-' || c in '0'..'9') number() else error("unexpected '$c' at $at")
            }
        }

        private fun obj(): Any? {
            at++
            val map = LinkedHashMap<String, Any?>()
            blank()
            if (text[at] == '}') {
                at++
                return map
            }
            while (true) {
                blank()
                val key = string()
                blank()
                expect(':')
                map[key] = value()
                blank()
                if (text[at++] == '}') break
            }
            return tagged(map) ?: map
        }

        private fun tagged(map: Map<String, Any?>): Double? {
            val tag = map[TAG] as? String ?: return null
            require(map.size == 1) { "a $TAG object has no other keys" }
            return when (tag) {
                "NaN" -> Double.NaN
                "Infinity" -> Double.POSITIVE_INFINITY
                "-Infinity" -> Double.NEGATIVE_INFINITY
                "-0" -> -0.0
                else -> error("unknown $TAG tag '$tag'")
            }
        }

        private fun list(): List<Any?> {
            at++
            val list = ArrayList<Any?>()
            blank()
            if (text[at] == ']') {
                at++
                return list
            }
            while (true) {
                list += value()
                blank()
                if (text[at++] == ']') break
            }
            return list
        }

        private fun string(): String {
            expect('"')
            val out = StringBuilder()
            while (true) {
                when (val c = text[at++]) {
                    '"' -> return out.toString()
                    '\\' ->
                        when (val e = text[at++]) {
                            'n' -> out.append('\n')
                            't' -> out.append('\t')
                            'r' -> out.append('\r')
                            'b' -> out.append('\b')
                            'f' -> out.append('\u000C')
                            'u' -> {
                                out.append(text.substring(at, at + 4).toInt(16).toChar())
                                at += 4
                            }
                            else -> out.append(e)
                        }
                    else -> out.append(c)
                }
            }
        }

        private fun number(): Double {
            val start = at
            while (at < text.length && (text[at] in '0'..'9' || text[at] in "+-.eE")) at++
            return text.substring(start, at).toDouble()
        }

        private fun literal(
            word: String,
            result: Any?,
        ): Any? {
            require(text.startsWith(word, at)) { "expected $word at $at" }
            at += word.length
            return result
        }

        private fun expect(c: Char) {
            require(text[at] == c) { "expected '$c' at $at" }
            at++
        }

        private fun blank() {
            while (at < text.length && text[at].isWhitespace()) at++
        }
    }

    private const val TAG = "\$f"
}
