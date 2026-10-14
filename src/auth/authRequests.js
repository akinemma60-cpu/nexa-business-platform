export function signUpWithEmailPassword(auth, { email, password, fullName, emailRedirectTo }) {
  return auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  });
}

export function resendSignupConfirmation(auth, email, emailRedirectTo) {
  return auth.resend({
    type: "signup",
    email,
    ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
  });
}

export function signInWithEmailPassword(auth, email, password) {
  return auth.signInWithPassword({ email, password });
}

export function requestPasswordReset(auth, email, redirectTo) {
  return auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
}

export function updateSignedInPassword(auth, password) {
  return auth.updateUser({ password });
}
