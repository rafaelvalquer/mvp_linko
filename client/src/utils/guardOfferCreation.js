export function getEffectivePixKeyMasked(workspace, payoutPixKeyMasked) {
  return String(
    payoutPixKeyMasked ||
      workspace?.payoutPixKeyMasked ||
      workspace?.pixSettings?.payoutPixKeyMasked ||
      "",
  ).trim();
}

export function hasPixAccountConfigured(workspace, payoutPixKeyMasked) {
  return !!getEffectivePixKeyMasked(workspace, payoutPixKeyMasked);
}

export function getOfferCreationGuardContext({
  targetPath = "/offers/new",
  canManagePixAccount = true,
} = {}) {
  if (canManagePixAccount) {
    return {
      title: "Configure sua Conta Pix para criar propostas",
    description:
      "Antes de gerar cobranças, você precisa cadastrar sua chave Pix.",
      redirectTo: targetPath,
    };
  }

  return {
    title: "Conta Pix pendente no workspace",
      description:
      "A Conta Pix do workspace ainda nao foi configurada. Peca ao dono do workspace para cadastrar a chave antes de gerar cobrancas.",
    redirectTo: null,
  };
}

export function guardOfferCreation({
  workspace,
  payoutPixKeyMasked,
  navigate,
  openPixModal,
  targetPath = "/offers/new",
  canManagePixAccount = true,
}) {
  if (hasPixAccountConfigured(workspace, payoutPixKeyMasked)) {
    navigate?.(targetPath);
    return true;
  }

  openPixModal?.(
    getOfferCreationGuardContext({
      targetPath,
      canManagePixAccount,
    }),
  );
  return false;
}
