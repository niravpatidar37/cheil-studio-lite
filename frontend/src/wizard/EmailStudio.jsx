import { Field, TextInput, TextArea } from "../components/form";
import EmailPreview from "./EmailPreview";
import EmailControls from "./EmailControls";

/**
 * Edit page for one email: live preview, copy fields, and the same kind of
 * design controls the banner editor offers.
 */
export default function EmailStudio({
  data,
  onFieldChange,
  product,
  inline,
  lang,
  emailType,
  background,
  onBackgroundChange,
  design,
  onDesignChange,
}) {
  const options = data.preference_options || [];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)_minmax(0,260px)]">
      <EmailPreview
        data={data}
        product={product}
        inline={inline}
        lang={lang}
        emailType={emailType}
        background={background}
        design={design}
        height={620}
      />

      <div className="space-y-3">
        <Field label="Subject">
          <TextInput value={data.subject || ""} onChange={(v) => onFieldChange("subject", v)} />
        </Field>
        <Field label="Preheader">
          <TextInput value={data.preheader || ""} onChange={(v) => onFieldChange("preheader", v)} />
        </Field>
        <Field label="Headline">
          <TextInput value={data.headline || ""} onChange={(v) => onFieldChange("headline", v)} />
        </Field>
        <Field label="Body">
          <TextArea value={data.body || ""} onChange={(v) => onFieldChange("body", v)} rows={7} />
        </Field>
        <Field label="Button label">
          <TextInput value={data.cta_label || ""} onChange={(v) => onFieldChange("cta_label", v)} />
        </Field>

        {options.length > 0 && (
          <Field label="Preference options">
            <div className="space-y-2">
              {options.map((opt, i) => (
                <TextInput
                  key={i}
                  value={opt}
                  onChange={(v) =>
                    onFieldChange(
                      "preference_options",
                      options.map((o, j) => (j === i ? v : o))
                    )
                  }
                />
              ))}
              <p className="text-xs leading-relaxed text-neutral-500">
                Re-engagement works by handing over control rather than pointing at
                inactivity — these are the choices the reader gets.
              </p>
            </div>
          </Field>
        )}
      </div>

      <EmailControls
        background={background}
        onBackgroundChange={onBackgroundChange}
        design={design}
        onDesignChange={onDesignChange}
        emailType={emailType}
      />
    </div>
  );
}
