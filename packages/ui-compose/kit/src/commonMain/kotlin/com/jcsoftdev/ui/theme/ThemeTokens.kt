package com.jcsoftdev.ui.theme

import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Corner shapes of every component, by role. Defaults mirror [UiShapes]; pass a [copy] to [UiTheme] to restyle the whole kit,
 * for example `ThemeShapes.Default.copy(control = CutCornerShape(8.dp))`.
 */
@Immutable
public class ThemeShapes(
    public val xs: Shape = UiShapes.xs,
    public val chip: Shape = UiShapes.chip,
    public val event: Shape = UiShapes.event,
    public val control: Shape = UiShapes.control,
    public val tile: Shape = UiShapes.tile,
    public val banner: Shape = UiShapes.banner,
    public val card: Shape = UiShapes.card,
    public val dialog: Shape = UiShapes.dialog,
    public val sheet: CornerBasedShape = UiShapes.sheet,
    public val pill: Shape = UiShapes.pill,
) {
    /** Copy with selected tokens replaced. */
    public fun copy(
        xs: Shape = this.xs,
        chip: Shape = this.chip,
        event: Shape = this.event,
        control: Shape = this.control,
        tile: Shape = this.tile,
        banner: Shape = this.banner,
        card: Shape = this.card,
        dialog: Shape = this.dialog,
        sheet: CornerBasedShape = this.sheet,
        pill: Shape = this.pill,
    ): ThemeShapes =
        ThemeShapes(
            xs = xs,
            chip = chip,
            event = event,
            control = control,
            tile = tile,
            banner = banner,
            card = card,
            dialog = dialog,
            sheet = sheet,
            pill = pill,
        )

    public companion object {
        /** The kit look. */
        public val Default: ThemeShapes = ThemeShapes()
    }
}

/**
 * Spacing, control heights and metrics of every component. Defaults mirror [UiSizes]; [minTouchTarget] is the accessible
 * hit area, [borderWidth] and [focusBorderWidth] the control outlines and [disabledAlpha] the opacity of disabled controls.
 */
@Immutable
public class ThemeSizes(
    public val space2: Dp = UiSizes.space2,
    public val space4: Dp = UiSizes.space4,
    public val space6: Dp = UiSizes.space6,
    public val space8: Dp = UiSizes.space8,
    public val space10: Dp = UiSizes.space10,
    public val space12: Dp = UiSizes.space12,
    public val space14: Dp = UiSizes.space14,
    public val space16: Dp = UiSizes.space16,
    public val space18: Dp = UiSizes.space18,
    public val space28: Dp = UiSizes.space28,
    public val sideWidth: Dp = UiSizes.sideWidth,
    public val topHeight: Dp = UiSizes.topHeight,
    public val controlHeight: Dp = UiSizes.controlHeight,
    public val controlHeightSm: Dp = UiSizes.controlHeightSm,
    public val controlHeightLg: Dp = UiSizes.controlHeightLg,
    public val inputHeight: Dp = UiSizes.inputHeight,
    public val agendaHour: Dp = UiSizes.agendaHour,
    public val agendaCol: Dp = UiSizes.agendaCol,
    public val mButton: Dp = UiSizes.mButton,
    public val mTray: Dp = UiSizes.mTray,
    public val mChip: Dp = UiSizes.mChip,
    public val mHour: Dp = UiSizes.mHour,
    public val minTouchTarget: Dp = 48.dp,
    public val borderWidth: Dp = 1.dp,
    public val focusBorderWidth: Dp = 2.dp,
    public val disabledAlpha: Float = 0.45f,
) {
    /** Copy with selected tokens replaced. */
    public fun copy(
        space2: Dp = this.space2,
        space4: Dp = this.space4,
        space6: Dp = this.space6,
        space8: Dp = this.space8,
        space10: Dp = this.space10,
        space12: Dp = this.space12,
        space14: Dp = this.space14,
        space16: Dp = this.space16,
        space18: Dp = this.space18,
        space28: Dp = this.space28,
        sideWidth: Dp = this.sideWidth,
        topHeight: Dp = this.topHeight,
        controlHeight: Dp = this.controlHeight,
        controlHeightSm: Dp = this.controlHeightSm,
        controlHeightLg: Dp = this.controlHeightLg,
        inputHeight: Dp = this.inputHeight,
        agendaHour: Dp = this.agendaHour,
        agendaCol: Dp = this.agendaCol,
        mButton: Dp = this.mButton,
        mTray: Dp = this.mTray,
        mChip: Dp = this.mChip,
        mHour: Dp = this.mHour,
        minTouchTarget: Dp = this.minTouchTarget,
        borderWidth: Dp = this.borderWidth,
        focusBorderWidth: Dp = this.focusBorderWidth,
        disabledAlpha: Float = this.disabledAlpha,
    ): ThemeSizes =
        ThemeSizes(
            space2 = space2,
            space4 = space4,
            space6 = space6,
            space8 = space8,
            space10 = space10,
            space12 = space12,
            space14 = space14,
            space16 = space16,
            space18 = space18,
            space28 = space28,
            sideWidth = sideWidth,
            topHeight = topHeight,
            controlHeight = controlHeight,
            controlHeightSm = controlHeightSm,
            controlHeightLg = controlHeightLg,
            inputHeight = inputHeight,
            agendaHour = agendaHour,
            agendaCol = agendaCol,
            mButton = mButton,
            mTray = mTray,
            mChip = mChip,
            mHour = mHour,
            minTouchTarget = minTouchTarget,
            borderWidth = borderWidth,
            focusBorderWidth = focusBorderWidth,
            disabledAlpha = disabledAlpha,
        )

    public companion object {
        /** The kit look. */
        public val Default: ThemeSizes = ThemeSizes()
    }
}

/**
 * Text styles of every component, by role. Defaults mirror [UiTypography]; the font family comes from [UiTheme] and the
 * line height is raised to at least 1.2x at use, so styles here carry size, weight and spacing.
 */
@Immutable
public class ThemeTypography(
    public val kpiNumber: TextStyle = UiTypography.kpiNumber,
    public val pageTitle: TextStyle = UiTypography.pageTitle,
    public val dialogTitle: TextStyle = UiTypography.dialogTitle,
    public val cardTitle: TextStyle = UiTypography.cardTitle,
    public val lede: TextStyle = UiTypography.lede,
    public val body: TextStyle = UiTypography.body,
    public val rowTitle: TextStyle = UiTypography.rowTitle,
    public val control: TextStyle = UiTypography.control,
    public val meta: TextStyle = UiTypography.meta,
    public val chipText: TextStyle = UiTypography.chipText,
    public val overline: TextStyle = UiTypography.overline,
    public val clock: TextStyle = UiTypography.clock,
    public val data: TextStyle = UiTypography.data,
    public val count: TextStyle = UiTypography.count,
    public val mTitle: TextStyle = UiTypography.mTitle,
    public val mCardTitle: TextStyle = UiTypography.mCardTitle,
    public val mRowTitle: TextStyle = UiTypography.mRowTitle,
    public val mBody: TextStyle = UiTypography.mBody,
    public val mButton: TextStyle = UiTypography.mButton,
    public val mMeta: TextStyle = UiTypography.mMeta,
) {
    /** Copy with selected tokens replaced. */
    public fun copy(
        kpiNumber: TextStyle = this.kpiNumber,
        pageTitle: TextStyle = this.pageTitle,
        dialogTitle: TextStyle = this.dialogTitle,
        cardTitle: TextStyle = this.cardTitle,
        lede: TextStyle = this.lede,
        body: TextStyle = this.body,
        rowTitle: TextStyle = this.rowTitle,
        control: TextStyle = this.control,
        meta: TextStyle = this.meta,
        chipText: TextStyle = this.chipText,
        overline: TextStyle = this.overline,
        clock: TextStyle = this.clock,
        data: TextStyle = this.data,
        count: TextStyle = this.count,
        mTitle: TextStyle = this.mTitle,
        mCardTitle: TextStyle = this.mCardTitle,
        mRowTitle: TextStyle = this.mRowTitle,
        mBody: TextStyle = this.mBody,
        mButton: TextStyle = this.mButton,
        mMeta: TextStyle = this.mMeta,
    ): ThemeTypography =
        ThemeTypography(
            kpiNumber = kpiNumber,
            pageTitle = pageTitle,
            dialogTitle = dialogTitle,
            cardTitle = cardTitle,
            lede = lede,
            body = body,
            rowTitle = rowTitle,
            control = control,
            meta = meta,
            chipText = chipText,
            overline = overline,
            clock = clock,
            data = data,
            count = count,
            mTitle = mTitle,
            mCardTitle = mCardTitle,
            mRowTitle = mRowTitle,
            mBody = mBody,
            mButton = mButton,
            mMeta = mMeta,
        )

    public companion object {
        /** The kit look. */
        public val Default: ThemeTypography = ThemeTypography()
    }
}
