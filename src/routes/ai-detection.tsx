import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  componentCategories,
  detectionApiBase,
  specsToText,
  tagsToText,
  textToSpecs,
  textToTags,
  type ComponentDetection,
} from "@/lib/component-detection";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileText,
  ImageUp,
  Loader2,
  PackagePlus,
  Save,
  ScanSearch,
  Sparkles,
  UploadCloud,
} from "lucide-react";

export const Route = createFileRoute("/ai-detection")({
  head: () => ({
    meta: [
      { title: "AI Component Detection - LAPKART AI" },
      {
        name: "description",
        content: "Upload laptop parts and accessories for AI image recognition, OCR, compatibility checks, and auto product creation.",
      },
    ],
  }),
  component: AiDetectionPage,
});

function AiDetectionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [folder, setFolder] = useState("uploads/components");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detection, setDetection] = useState<ComponentDetection | null>(null);
  const [form, setForm] = useState<Partial<ComponentDetection>>({});
  const [specText, setSpecText] = useState("");
  const [tagText, setTagText] = useState("");
  const [keywordText, setKeywordText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const setSelectedFile = useCallback((next: File | null) => {
    setFile(next);
    setDetection(null);
    setForm({});
    setSpecText("");
    setTagText("");
    setKeywordText("");
    setProgress(0);
    setPreview(next ? URL.createObjectURL(next) : "");
  }, []);

  const canSave = Boolean(detection?.id);

  const detect = async () => {
    if (!file) {
      toast.error("Upload a component image first");
      return;
    }
    setLoading(true);
    setProgress(18);
    try {
      const body = new FormData();
      body.append("image", file);
      body.append("folder", folder);
      setProgress(42);
      const response = await fetch(`${detectionApiBase}/components/detect`, {
        method: "POST",
        body,
      });
      setProgress(76);
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json() as { detection: ComponentDetection };
      setDetection(result.detection);
      setForm(result.detection);
      setSpecText(specsToText(result.detection.specifications ?? {}));
      setTagText(tagsToText(result.detection.tags ?? []));
      setKeywordText(tagsToText(result.detection.keywords ?? []));
      setProgress(100);
      toast.success("Component detected and saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Detection failed");
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const saveEdits = async () => {
    if (!detection) return;
    setLoading(true);
    try {
      const payload = {
        component_name: form.component_name,
        category: form.category,
        brand: form.brand,
        model_number: form.model_number,
        specifications: textToSpecs(specText),
        condition: form.condition,
        confidence_score: Number(form.confidence_score ?? 0),
        ocr_text: form.ocr_text,
        tags: textToTags(tagText),
        keywords: textToTags(keywordText),
        product_title: form.product_title,
        product_description: form.product_description,
        seo_tags: textToTags(tagText),
        status: "edited",
      };
      const response = await fetch(`${detectionApiBase}/components/detections/${detection.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json() as { detection: ComponentDetection };
      setDetection(result.detection);
      setForm(result.detection);
      toast.success("Detection saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const createProduct = async () => {
    if (!detection) return;
    setLoading(true);
    try {
      await saveEdits();
      const response = await fetch(`${detectionApiBase}/components/detections/${detection.id}/create-product`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ price: 999, stock: 1 }),
      });
      if (!response.ok) throw new Error(await response.text());
      toast.success("Product listing created for approval");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Product creation failed");
    } finally {
      setLoading(false);
    }
  };

  const confidence = useMemo(() => Number(form.confidence_score ?? detection?.confidence_score ?? 0), [form, detection]);

  return (
    <div className="min-h-screen bg-[var(--background-base)] text-foreground">
      <Header />
      <section className="border-b border-[var(--border-faint)] bg-white">
        <div className="container mx-auto px-4 py-10">
          <p className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">ai vision / component detection</p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_0.7fr] lg:items-end">
            <div>
              <h1 className="font-display text-title-h3 text-foreground">Upload a laptop part. Let AI build the listing.</h1>
              <p className="mt-2 max-w-2xl text-body-medium text-[var(--black-alpha-56)]">
                Detect category, brand, model number, specs, condition, OCR text, SEO tags, similar products, compatibility, and product copy.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {["Vision", "OCR", "Auto listing"].map((item) => (
                <div key={item} className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3 text-mono-x-small uppercase tracking-wider">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-lg border border-[var(--border-faint)] bg-white p-6">
          <h2 className="font-display text-title-h5">Image upload</h2>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              setSelectedFile(event.dataTransfer.files?.[0] ?? null);
            }}
            className="mt-5 grid min-h-80 place-items-center rounded-lg border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] p-5 text-center"
          >
            {preview ? (
              <img src={preview} alt="Component preview" className="max-h-72 w-full rounded-md object-contain" />
            ) : (
              <div>
                <UploadCloud className="mx-auto size-12 text-[var(--heat-100)]" />
                <p className="mt-4 text-label-medium">Drag and drop component image</p>
                <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">RAM, SSD, HDD, motherboard, charger, display, battery, laptop body, and more.</p>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button onClick={() => inputRef.current?.click()} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-4 text-label-small hover:border-[var(--heat-100)]">
              <ImageUp className="size-4" /> Upload image
            </button>
            <button onClick={() => cameraRef.current?.click()} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-4 text-label-small hover:border-[var(--heat-100)]">
              <Camera className="size-4" /> Camera upload
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
          </div>

          <label className="mt-4 block">
            <span className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">Storage folder</span>
            <select value={folder} onChange={(event) => setFolder(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium">
              <option value="uploads/components">uploads/components/</option>
              <option value="uploads/products">uploads/products/</option>
              <option value="uploads/vendors">uploads/vendors/</option>
            </select>
          </label>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--background-lighter)]">
            <div className="h-full bg-[var(--heat-100)] transition-all" style={{ width: `${progress}%` }} />
          </div>

          <button onClick={detect} disabled={loading || !file} className="button button-primary mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md text-label-medium disabled:opacity-60">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
            {loading ? "Analyzing image..." : "Run AI detection"}
          </button>
        </section>

        <section className="rounded-lg border border-[var(--border-faint)] bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-title-h5">Detection result</h2>
              <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">Review the AI output, edit it, then save or create a product listing.</p>
            </div>
            {detection && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--heat-8)] px-2 py-1 text-mono-x-small uppercase tracking-wider text-[var(--heat-100)]">
                <Sparkles className="size-3" /> {confidence}% confidence
              </span>
            )}
          </div>

          {!detection ? (
            <div className="mt-8 grid min-h-96 place-items-center rounded-lg border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] text-center">
              <div>
                <FileText className="mx-auto size-10 text-[var(--black-alpha-32)]" />
                <p className="mt-3 text-label-medium">Detection details will appear here</p>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Component name" value={form.component_name ?? ""} onChange={(value) => setForm({ ...form, component_name: value })} />
                <label>
                  <span className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">Category</span>
                  <select value={form.category ?? ""} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-[var(--border-muted)] px-3 text-body-medium">
                    {componentCategories.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
                <Field label="Brand" value={form.brand ?? ""} onChange={(value) => setForm({ ...form, brand: value })} />
                <Field label="Model number" value={form.model_number ?? ""} onChange={(value) => setForm({ ...form, model_number: value })} />
                <Field label="Condition" value={form.condition ?? ""} onChange={(value) => setForm({ ...form, condition: value })} />
                <Field label="Product title" value={form.product_title ?? ""} onChange={(value) => setForm({ ...form, product_title: value })} />
              </div>

              <Textarea label="Specifications" value={specText} onChange={setSpecText} />
              <Textarea label="OCR text" value={form.ocr_text ?? ""} onChange={(value) => setForm({ ...form, ocr_text: value })} />
              <Textarea label="Product description" value={form.product_description ?? ""} onChange={(value) => setForm({ ...form, product_description: value })} />
              <Field label="Tags" value={tagText} onChange={setTagText} />
              <Field label="Keywords" value={keywordText} onChange={setKeywordText} />

              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={saveEdits} disabled={!canSave || loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-4 text-label-small hover:border-[var(--heat-100)] disabled:opacity-60">
                  <Save className="size-4" /> Edit and save
                </button>
                <button onClick={createProduct} disabled={!canSave || loading} className="button button-primary inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-label-small disabled:opacity-60">
                  <PackagePlus className="size-4" /> Auto create product
                </button>
              </div>

              <div className="rounded-lg border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4">
                <p className="flex items-center gap-2 text-label-small"><BadgeCheck className="size-4 text-[var(--heat-100)]" /> Similar and compatibility insights</p>
                <p className="mt-2 text-body-small text-[var(--black-alpha-56)]">Compatible: {(detection.compatible_models ?? []).join(", ")}</p>
                <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">Similar: {(detection.similar_products ?? []).join(", ")}</p>
                <p className="mt-1 flex items-center gap-1 text-body-small text-[var(--accent-forest)]"><CheckCircle2 className="size-3" /> Status: {detection.status}</p>
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-[var(--border-muted)] px-3 text-body-medium outline-none focus:border-[var(--heat-100)]" />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="mt-1 w-full rounded-md border border-[var(--border-muted)] px-3 py-2 text-body-medium outline-none focus:border-[var(--heat-100)]" />
    </label>
  );
}
