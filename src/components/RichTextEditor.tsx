import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { htmlToMarkdown, looksLikeMarkdown, markdownToHtml } from "@/lib/markdown";
import {
  Bold,
  Code2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";

type RichTextEditorProps = {
  /** Markdown persistido. */
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClass?: string;
  /** Remontar quando o card muda. */
  instanceKey: string;
};

function setLink(editor: Editor) {
  const prev = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("URL do link", prev ?? "https://");
  if (url === null) return;
  const t = url.trim();
  if (t === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: t }).run();
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Escreva aqui…",
  className,
  minHeightClass = "min-h-[120px]",
  instanceKey,
}: RichTextEditorProps) {
  const [markdownMode, setMarkdownMode] = useState(false);
  const [draftMd, setDraftMd] = useState(value);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    if (markdownMode) setDraftMd(value);
  }, [value, markdownMode]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3, 4] },
          bulletList: { HTMLAttributes: { class: "list-disc pl-4" } },
          orderedList: { HTMLAttributes: { class: "list-decimal pl-4" } },
        }),
        Underline,
        Link.configure({ openOnClick: false, autolink: true }),
        Image.configure({ inline: true, allowBase64: true }),
        Placeholder.configure({ placeholder }),
      ],
      content: markdownToHtml(value),
      onCreate: ({ editor: ed }) => {
        editorRef.current = ed;
      },
      onDestroy: () => {
        editorRef.current = null;
      },
      editorProps: {
        attributes: {
          class: cn(
            "prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2",
            minHeightClass,
          ),
        },
        handlePaste: (_view, event) => {
          const text = event.clipboardData?.getData("text/plain");
          if (!text || !looksLikeMarkdown(text)) return false;
          event.preventDefault();
          const ed = editorRef.current;
          if (!ed) return true;
          ed.chain().focus().insertContent(markdownToHtml(text)).run();
          return true;
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChange(htmlToMarkdown(ed.getHTML()));
      },
    },
    [instanceKey],
  );

  useEffect(() => {
    if (!editor || markdownMode) return;
    const current = htmlToMarkdown(editor.getHTML());
    if (current === value) return;
    editor.commands.setContent(markdownToHtml(value));
  }, [editor, value, markdownMode, instanceKey]);

  const addImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      if (file.size > 2 * 1024 * 1024) {
        window.alert("Imagem demasiado grande (máx. 2 MB).");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = typeof reader.result === "string" ? reader.result : "";
        if (src) editor.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [editor]);

  if (!editor) {
    return (
      <div className={cn("rounded-md border border-border/60 bg-muted/20 animate-pulse h-32", className)} />
    );
  }

  const toggleMarkdown = () => {
    if (markdownMode) {
      const md = draftMd;
      onChange(md);
      editor.commands.setContent(markdownToHtml(md));
      setMarkdownMode(false);
    } else {
      setDraftMd(htmlToMarkdown(editor.getHTML()));
      setMarkdownMode(true);
    }
  };

  return (
    <div
      className={cn(
        "rounded-md border border-border/60 bg-background overflow-hidden transition-shadow",
        "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/40",
        className,
      )}
    >
      {!markdownMode && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border/50 bg-muted/30 px-1 py-1">
          <ToolbarBtn
            pressed={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            label="Negrito"
          >
            <Bold className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            pressed={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            label="Itálico"
          >
            <Italic className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            pressed={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            label="Sublinhado"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            pressed={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            label="Riscado"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarBtn>
          <span className="w-px h-5 bg-border/80 mx-0.5" aria-hidden />
          <ToolbarBtn
            pressed={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            label="Lista"
          >
            <List className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            pressed={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            label="Lista numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} label="Código" pressed={editor.isActive("codeBlock")}>
            <Code2 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Linha">
            <Minus className="h-4 w-4" />
          </ToolbarBtn>
          <span className="w-px h-5 bg-border/80 mx-0.5" aria-hidden />
          <ToolbarBtn onClick={() => setLink(editor)} label="Hiperligação" pressed={editor.isActive("link")}>
            <Link2 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={addImage} label="Imagem">
            <ImagePlus className="h-4 w-4" />
          </ToolbarBtn>
        </div>
      )}

      {markdownMode ? (
        <Textarea
          value={draftMd}
          onChange={(e) => {
            const v = e.target.value;
            setDraftMd(v);
            onChange(v);
          }}
          className={cn("min-h-[140px] resize-y rounded-none border-0 font-mono text-sm", minHeightClass)}
          placeholder="Markdown…"
        />
      ) : (
        <EditorContent editor={editor} className="rich-text-editor-content" />
      )}

      <div className="flex justify-end border-t border-border/40 bg-muted/10 px-2 py-1.5">
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={toggleMarkdown}
        >
          {markdownMode ? "Voltar ao editor rico" : "Alternar para editor Markdown"}
        </button>
      </div>
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  pressed,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-8 w-8 p-0 shrink-0", pressed && "bg-muted")}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}
