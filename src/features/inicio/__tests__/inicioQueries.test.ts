import { QueryClient } from "@tanstack/react-query";
import { inicioKeys, invalidateInicioData } from "../inicioQueries";

it("invalida todas las secciones de Inicio sin tocar otras funcionalidades", async () => {
  const client = new QueryClient();
  for (const key of Object.values(inicioKeys)) client.setQueryData(key, []);
  client.setQueryData(["studentSearch", "active", "Ana", 1], []);
  await invalidateInicioData(client);
  for (const key of Object.values(inicioKeys))
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(client.getQueryState(["studentSearch", "active", "Ana", 1])?.isInvalidated).toBe(false);
  client.clear();
});
