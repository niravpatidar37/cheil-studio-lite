import JSZip from "jszip";

export async function downloadZip(filename, files) {
  const zip = new JSZip();
  files.forEach(({ name, content }) => zip.file(name, content));
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
