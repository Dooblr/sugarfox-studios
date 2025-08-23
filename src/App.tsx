// ---- App.tsx ----
import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import * as d3 from "d3";
import Background3d from "./Background3d";
import "./App.css";

function DarkModeToggle({ toggleTheme, theme }: { toggleTheme: () => void; theme: string }) {
  return (
    <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

function Home({ theme, toggleTheme }: { theme: string; toggleTheme: () => void }) {
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const updateScrollY = useCallback(() => {
    if (containerRef.current) {
      const scrollTop = containerRef.current.scrollTop;
      const maxScroll = containerRef.current.scrollHeight - containerRef.current.clientHeight;
      const normalizedScroll = Math.min(scrollTop / (maxScroll * 0.5), 1);
      const easedScroll = normalizedScroll * normalizedScroll * (3 - 2 * normalizedScroll);
      setScrollY(easedScroll);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => requestAnimationFrame(updateScrollY);
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [updateScrollY]);

  const contentOpacity = Math.max(0, Math.min(1, (scrollY - 0.15) / 0.5));
  const handleContinue = useCallback(() => {
    const target = document.getElementById("d3-section");
    if (target && containerRef.current) {
      containerRef.current.scrollTo({ top: target.offsetTop, behavior: "smooth" });
    }
  }, []);

  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const data = [12, 25, 6, 18, 30, 22];
    const width = svgEl.clientWidth || 800;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const x = d3
      .scaleBand()
      .domain(data.map((_, i) => String(i)))
      .range([margin.left, width - margin.right])
      .padding(0.2);

    const y = d3.scaleLinear().domain([0, d3.max(data)!]).nice().range([height - margin.bottom, margin.top]);

    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat((d) => `#${Number(d) + 1}`));

    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y));

    svg
      .append("g")
      .selectAll("rect")
      .data(data)
      .join("rect")
      .attr("x", (_, i) => x(String(i))!)
      .attr("y", (d) => y(d))
      .attr("height", (d) => y(0) - y(d))
      .attr("width", x.bandwidth())
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", theme === "dark" ? "#00aaff" : "#007acc")
      .on("mouseenter", function () {
        d3.select(this).attr("opacity", 0.8);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("opacity", 1);
      });

    const resize = () => {
      const w = svgEl.clientWidth || 800;
      svg.attr("viewBox", `0 0 ${w} ${height}`);
      x.range([margin.left, w - margin.right]);
      svg.selectAll("rect").attr("x", (_, i) => x(String(i))!).attr("width", x.bandwidth());
      svg.select<SVGGElement>("g").call(d3.axisBottom(x).tickFormat((d) => `#${Number(d) + 1}`));
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      svg.selectAll("*").remove();
    };
  }, [theme]);

  const memoizedBackground = useMemo(() => <Background3d theme={theme} zoomLevel={scrollY} />, [theme, scrollY]);

  return (
    <div ref={containerRef} className={`scroll-container container ${theme}`}>
      <DarkModeToggle toggleTheme={toggleTheme} theme={theme} />

      <div className="fixed-background">{memoizedBackground}</div>

      <div className="company-header">
        <h1>Sugarfox Studios</h1>
      </div>

      <div className="scroll-content">
        <div style={{ height: "100vh" }} />

        <section
          className="welcome-section"
          style={{ opacity: contentOpacity, transform: `translateY(${(1 - contentOpacity) * 20}px)` }}
        >
          <div className="content-wrapper">
            <h2>Welcome</h2>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
            <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
            <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.</p>

            <div className="section-footer">
              <button className="button continue-button" onClick={handleContinue}>
                Continue
              </button>
            </div>
          </div>
        </section>

        <section className="d3-section" id="d3-section">
          <h2>Example D3 Chart</h2>
          <svg ref={svgRef} width="100%" height={300} role="img" aria-label="Example bar chart" />
          <p style={{ maxWidth: 800, margin: "1.5rem auto" }}>
            This is a small example of a responsive D3 bar chart. Replace the data array in <code>Home</code> with your own values to visualize something real.
          </p>
        </section>

        <div style={{ height: "50vh" }} />
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState<string>("dark");
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home theme={theme} toggleTheme={toggleTheme} />} />
      </Routes>
    </Router>
  );
}

export default App;
