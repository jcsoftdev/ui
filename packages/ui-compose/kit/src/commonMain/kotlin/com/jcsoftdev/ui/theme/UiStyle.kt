package com.jcsoftdev.ui.theme

/**
 * The look of the control and navigation layer, mirroring the web presets. [Default] keeps every surface opaque (the
 * pre-glass look). [Glass] turns the chrome surfaces (sheets, dialogs, menus, toasts, top and action bars) into glass (frosted by default, lensed Liquid Glass with `UiTheme(glassVariant = GlassVariant.Liquid)`);
 * content surfaces such as [com.jcsoftdev.ui.containers.Card] stay solid unless they ask for a material.
 */
public enum class UiStyle {
    /** Opaque chrome. */
    Default,

    /** Glass chrome over the content below it. */
    Glass,
}
