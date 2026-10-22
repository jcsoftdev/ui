package com.jcsoftdev.ui.auth

import androidx.compose.runtime.Stable

/** What the sign-in form is doing right now; the header art reacts to it ([AuthArcs]). */
public enum class AuthState {
    /** Nothing typed yet. */
    Idle,

    /** The user is filling the identifier, or both fields are touched. */
    Typing,

    /** The password field has focus. */
    Password,

    /** The last attempt was rejected. */
    Error,

    /** The last attempt was accepted. */
    Success,
}

/** Pure rules that turn form state into an [AuthState], a completion fraction and the arc look. */
@Stable
public object AuthProgress {
    /** Identifier length that counts as half of the form. */
    public const val IdCapacity: Int = 12

    /** Password length that counts as the other half of the form. */
    public const val PasswordCapacity: Int = 8

    /** Form completion in 0..1: the identifier fills the first half (up to [IdCapacity] characters), the password the second (up to [PasswordCapacity]). */
    public fun of(
        idLength: Int,
        passwordLength: Int,
    ): Float {
        val id = idLength.coerceIn(0, IdCapacity).toFloat() / IdCapacity
        val password = passwordLength.coerceIn(0, PasswordCapacity).toFloat() / PasswordCapacity
        return (id + password) / 2f
    }

    /** The [AuthState] of a form: success wins over error, error over focus and typing. */
    public fun stateOf(
        idLength: Int,
        passwordLength: Int,
        passwordFocused: Boolean,
        error: Boolean = false,
        success: Boolean = false,
    ): AuthState =
        when {
            success -> AuthState.Success
            error -> AuthState.Error
            passwordFocused -> AuthState.Password
            idLength > 0 || passwordLength > 0 -> AuthState.Typing
            else -> AuthState.Idle
        }

    /** Brightness of the arcs in 0..1: typing brightens with [progress], the password field dims them, an error lifts them, success is full. */
    public fun emphasis(
        state: AuthState,
        progress: Float,
    ): Float {
        val p = progress.coerceIn(0f, 1f)
        return when (state) {
            AuthState.Idle -> 0.35f
            AuthState.Typing -> 0.45f + 0.45f * p
            AuthState.Password -> 0.25f + 0.25f * p
            AuthState.Error -> 0.7f
            AuthState.Success -> 1f
        }
    }

    /** Angle in degrees each arc covers: it advances from 70 to 120 as [progress] goes from 0 to 1. */
    public fun sweepDegrees(progress: Float): Float = 70f + 50f * progress.coerceIn(0f, 1f)
}
