"use client";

import { useCallback, useEffect, useState } from "react";

import {
  alternarFavoritoPOS,
  esFavoritoPOS,
  type FavoritosPOS,
  guardarFavoritosPOS,
  leerFavoritosPOS,
} from "@/lib/pos/favoritos";

/** Favoritos locales del catálogo, hidratados desde `localStorage` al montar. */
export function useFavoritosPOS() {
  const [favoritos, setFavoritos] = useState<FavoritosPOS>({});
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setFavoritos(leerFavoritosPOS(window.localStorage));
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    guardarFavoritosPOS(window.localStorage, favoritos);
  }, [favoritos, hidratado]);

  const alternar = useCallback((producto: { producto_id: string; favorito_pos: boolean }) => {
    setFavoritos((actual) => alternarFavoritoPOS(actual, producto));
  }, []);

  const esFavorito = useCallback(
    (producto: { producto_id: string; favorito_pos: boolean }) => esFavoritoPOS(favoritos, producto),
    [favoritos],
  );

  return { favoritos, alternar, esFavorito };
}
