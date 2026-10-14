package com.jcsoftdev.ui.sizeprobe

import android.app.Activity
import android.os.Bundle

/** The single entry point R8 keeps: the flavour's Probe is reachable from here and nothing else of the artifact is. */
class ProbeActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = Probe.touch()
    }
}
