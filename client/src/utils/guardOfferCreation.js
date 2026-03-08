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

export function getOfferCreationGuardContext(targetPath = "/offers/new") {
  return {
    title: "Configure sua Conta Pix para criar propostas",
    description:
      "Antes de gerar cobranças, você precisa cadastrar sua chave Pix.",
    redirectTo: targetPath,
  };
}

export function guardOfferCreation({
  workspace,
  payoutPixKeyMasked,
  navigate,
  openPixModal,
  targetPath = "/offers/new",
}) {
  if (hasPixAccountConfigured(workspace, payoutPixKeyMasked)) {
    navigate?.(targetPath);
    return true;
  }

  openPixModal?.(getOfferCreationGuardContext(targetPath));
  return false;
}
