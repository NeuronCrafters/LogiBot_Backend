export async function definirNivelService(nivel: string) {
  return {
    responses: [{ text: `Nivel ${nivel} definido.` }],
  };
}
