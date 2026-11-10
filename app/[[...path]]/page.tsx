"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Visit = { id: number; created_at: string; path: string };
type VisitsResponse = { visits: Visit[]; total: number; paths: string[] };

export default function Home() {
  const pathname = usePathname() || "/";
  const [visits, setVisits] = useState<Visit[]>([]);
  const [paths, setPaths] = useState<string[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadVisits = useCallback(async (pathFilter = "") => {
    try {
      const query = pathFilter ? `?path=${encodeURIComponent(pathFilter)}` : "";
      const response = await fetch(`/api/visits${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Request failed");
      const data: VisitsResponse = await response.json();
      setVisits(data.visits);
      setPaths(data.paths);
      setTotal(data.total);
      setError("");
    } catch {
      setError("Не удалось загрузить журнал. Проверьте настройки базы данных.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function registerAndLoad() {
      setLoading(true);
      // Корень сайта — только просмотр журнала, он никогда не записывается.
      if (pathname !== "/") {
        try {
          const response = await fetch("/api/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: pathname }),
            cache: "no-store"
          });
          if (!response.ok) throw new Error("Registration failed");
        } catch {
          if (!cancelled) setError("Не удалось записать посещение. Проверьте настройки базы данных.");
        }
      }
      if (!cancelled) await loadVisits("");
    }

    registerAndLoad();
    return () => { cancelled = true; };
  }, [pathname, loadVisits]);

  async function changeFilter(value: string) {
    setSelectedPath(value);
    setLoading(true);
    await loadVisits(value);
  }

  return (
    <main className="page">
      <section className="panel">
        <div className="eyebrow">АНАЛИТИКА САЙТА</div>
        <h1>Журнал посещений</h1>
        <p className="subtitle">Записываются загрузки страниц с путём, кроме главной страницы «/». Перезагрузки тоже учитываются.</p>

        <div className="counter">
          <span className="counter-label">{selectedPath ? `Посещений: ${selectedPath}` : "Всего посещений"}</span>
          <strong>{total === null ? "—" : total.toLocaleString("ru-RU")}</strong>
        </div>

        <div className="filters">
          <label htmlFor="path-filter">Фильтр по пути</label>
          <select id="path-filter" value={selectedPath} onChange={(event) => changeFilter(event.target.value)}>
            <option value="">Все пути</option>
            {paths.map((path) => <option value={path} key={path}>{path}</option>)}
          </select>
        </div>

        <div className="list-heading">
          <h2>{selectedPath ? "Посещения по выбранному пути" : "Последние посещения"}</h2>
          <button onClick={() => loadVisits(selectedPath)} type="button">Обновить</button>
        </div>

        {error && <p className="error">{error}</p>}
        {loading ? <p className="empty">Загрузка…</p> : visits.length === 0 ? <p className="empty">Для выбранного фильтра посещений пока нет.</p> : (
          <div className="table-wrap">
            <table className="visits-table">
              <thead><tr><th>№</th><th>Путь</th><th>Дата и время</th></tr></thead>
              <tbody>
                {visits.map((visit, index) => (
                  <tr key={visit.id}>
                    <td className="number">{total !== null ? total - index : index + 1}</td>
                    <td className="path-cell"><code>{visit.path}</code></td>
                    <td><time dateTime={visit.created_at}>{new Date(visit.created_at).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "medium" })}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="footnote">Сохраняются только путь страницы и время на стороне сервера. Главная страница «/» не записывается. IP-адреса, имена, cookies и данные устройств не собираются. В списке отображаются последние 500 записей, фильтр строится по всем путям в базе.</p>
      </section>
    </main>
  );
}
