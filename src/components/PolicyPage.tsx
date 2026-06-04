import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export type PolicySection = {
  title: string;
  body: string;
};

export function PolicyPage({
  eyebrow,
  title,
  description,
  sections,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: PolicySection[];
}) {
  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />
      <main>
        <section className="border-b border-[var(--border-faint)] bg-white">
          <div className="container mx-auto max-w-4xl px-4 py-12">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-label-small text-[var(--black-alpha-56)] transition-colors hover:text-[var(--heat-100)]"
            >
              <ArrowLeft className="size-4" />
              Home
            </Link>
            <p className="mt-8 text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-display text-title-h2 text-foreground">{title}</h1>
            <p className="mt-4 max-w-2xl text-body-large text-[var(--black-alpha-64)]">
              {description}
            </p>
          </div>
        </section>

        <section className="container mx-auto max-w-4xl px-4 py-10">
          <div className="divide-y divide-[var(--border-faint)] rounded-lg border border-[var(--border-muted)] bg-white">
            {sections.map((section) => (
              <article key={section.title} className="p-6">
                <h2 className="text-title-h5 text-foreground">{section.title}</h2>
                <p className="mt-3 text-body-medium leading-relaxed text-[var(--black-alpha-64)]">
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
