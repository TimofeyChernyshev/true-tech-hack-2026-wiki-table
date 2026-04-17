import { WikiDocumentEditor } from '../editor/WikiDocumentEditor'
import { DocumentPageHeader } from './DocumentPageHeader'
import { WikiPagesSidebar } from './WikiPagesSidebar'
import { NewPageModal } from './NewPageModal'
import { wikiDocStorageKey } from './wikiPageRegistry'
import { useWikiDocumentPage } from './hooks/useWikiDocumentPage'
import '../App.css'

export function DocumentPage() {
  const {
    pageKey,
    pages,
    backlinkKeys,
    newPageOpen,
    setNewPageOpen,
    pagesSidebarOpen,
    setPagesSidebarOpen,
    title,
    setTitle,
    subtitle,
    setSubtitle,
    autoSaveMs,
    setAutoSaveMs,
    onCreatePage,
    onConfirmNewPage,
    pageExists: docExists,
  } = useWikiDocumentPage()

  if (!docExists) {
    return null
  }

  const storageKey = wikiDocStorageKey(pageKey)

  return (
    <div className="wiki-app" data-testid="documentPage-root">
      <NewPageModal
        open={newPageOpen}
        onClose={() => setNewPageOpen(false)}
        onCreate={onConfirmNewPage}
      />
      <div className="wiki-layout-with-pages">
        {pagesSidebarOpen ? (
          <WikiPagesSidebar
            pages={pages}
            currentPageKey={pageKey}
            backlinkKeys={backlinkKeys}
            onCreatePage={onCreatePage}
          />
        ) : null}
        <div className="wiki-layout-main-column">
          <DocumentPageHeader
            pagesSidebarOpen={pagesSidebarOpen}
            onToggleSidebar={() => setPagesSidebarOpen((v) => !v)}
            title={title}
            onTitleChange={setTitle}
            subtitle={subtitle}
            onSubtitleChange={setSubtitle}
            autoSaveMs={autoSaveMs}
            onAutoSaveMsChange={setAutoSaveMs}
          />

          <WikiDocumentEditor
            storageKey={storageKey}
            pageKey={pageKey}
            excerpt={subtitle}
            autoSaveIntervalMs={autoSaveMs}
          />
        </div>
      </div>
    </div>
  )
}
