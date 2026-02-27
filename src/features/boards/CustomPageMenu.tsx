/**
 * Page menu with share/link controls.
 *
 * Guest users: local pages, "Login to share" hint, can open shared links.
 * Authed users: DB pages, share button for owners, copy link for shared pages.
 */

import type { TLPageId } from '@tldraw/tlschema'
import { stopEventPropagation, tlenv, useEditor, useValue } from '@tldraw/editor'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import {
	PageItemInput,
	PageRecordType,
	PORTRAIT_BREAKPOINT,
	TldrawUiButton,
	TldrawUiButtonCheck,
	TldrawUiButtonIcon,
	TldrawUiButtonLabel,
	TldrawUiPopover,
	TldrawUiPopoverContent,
	TldrawUiPopoverTrigger,
	useBreakpoint,
	useMenuIsOpen,
	useReadonly,
	useTranslation,
	useUiEvents,
} from 'tldraw'
import { useSortablePages } from './hooks/useSortablePages'
import { useBoardsMachine } from './MachineContext'
import {
	OpenSharedLinkPopover,
	SharePageButton,
	CustomPageItemSubmenu,
} from './components/page-menu'

export const CustomPageMenu = memo(function CustomPageMenu() {
	const editor = useEditor()
	const trackEvent = useUiEvents()
	const msg = useTranslation()
	const breakpoint = useBreakpoint()
	const { user } = useAuth()
	const { state } = useBoardsMachine()

	const [isEditing, setIsEditing] = useState(false)
	const handleOpenChange = useCallback(() => setIsEditing(false), [])
	const [isOpen, onOpenChange] = useMenuIsOpen('page-menu', handleOpenChange)

	const ITEM_HEIGHT = 36
	const allTldrawPages = useValue('pages', () => editor.getPages(), [editor])

	// For authed users, only show pages that exist in the DB.
	// For guests, show all tldraw pages.
	const dbPageIds = useMemo(
		() => new Set(state.context.pages.map((e) => e.tldrawId)),
		[state.context.pages]
	)
	const displayPages = useMemo(() => {
		if (!user) return allTldrawPages
		const filtered = allTldrawPages.filter((p) => dbPageIds.has(p.id))
		return filtered.length > 0 ? filtered : allTldrawPages
	}, [user, allTldrawPages, dbPageIds])
	const currentPage = useValue('currentPage', () => editor.getCurrentPage(), [editor])
	const currentPageId = useValue('currentPageId', () => editor.getCurrentPageId(), [editor])
	const isReadonlyMode = useReadonly()
	const maxPageCountReached = useValue(
		'maxPageCountReached',
		() => editor.getPages().length >= editor.options.maxPages,
		[editor]
	)
	const isCoarsePointer = useValue(
		'isCoarsePointer',
		() => editor.getInstanceState().isCoarsePointer,
		[editor]
	)

	useEffect(
		function closeOnEnter() {
			function handleKeyDown() {
				if (isEditing) return
				if (document.activeElement === document.body) editor.menus.clearOpenMenus()
			}
			document.addEventListener('keydown', handleKeyDown, { passive: true })
			return () => document.removeEventListener('keydown', handleKeyDown)
		},
		[editor, isEditing]
	)

	const toggleEditing = useCallback(() => {
		if (isReadonlyMode) return
		setIsEditing((s) => !s)
	}, [isReadonlyMode])

	const {
		sortablePositionItems,
		rSortableContainer,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handleKeyDown,
	} = useSortablePages(displayPages, ITEM_HEIGHT, editor, trackEvent as (name: string, data?: unknown) => void)

	useEffect(() => {
		if (!isOpen) return
		editor.timers.requestAnimationFrame(() => {
			const elm = document.querySelector(`[data-pageid="${currentPageId}"]`) as HTMLDivElement
			if (!elm) return
			elm.querySelector('button')?.focus()
			const container = rSortableContainer.current
			if (!container) return
			const elmTop = elm.offsetTop
			if (elmTop < container.scrollTop) container.scrollTo({ top: elmTop })
			const elmBottom = elmTop + ITEM_HEIGHT
			const containerBottom = container.scrollTop + container.offsetHeight
			if (elmBottom > containerBottom) container.scrollTo({ top: elmBottom - container.offsetHeight })
		})
	}, [ITEM_HEIGHT, currentPageId, isOpen, editor, rSortableContainer])

	const handleCreatePage = useCallback(() => {
		if (isReadonlyMode) return

		if (user) {
			// Authed: create in DB first
			void (async () => {
				const { createPage } = await import('./api')
				const pageName = msg('page-menu.new-page-initial-name')
				const newPage = await createPage({ title: pageName })
				if (!newPage) return

				editor.run(() => {
					editor.markHistoryStoppingPoint('creating page')
					editor.createPage({ name: pageName, id: newPage.tldraw_page_id as any })
					editor.setCurrentPage(newPage.tldraw_page_id as any)
					setIsEditing(true)
				})

				editor.timers.requestAnimationFrame(() => {
					const elm = document.querySelector(`[data-pageid="${newPage.tldraw_page_id}"]`) as HTMLDivElement
					elm?.querySelector('button')?.focus()
				})

				window.dispatchEvent(new Event('v2-pages-changed'))
				editor.menus.clearOpenMenus()
				trackEvent('new-page', { source: 'page-menu' })
			})()
			return
		}

		// Guest: create locally
		editor.run(() => {
			editor.markHistoryStoppingPoint('creating page')
			const newPageId = PageRecordType.createId()
			editor.createPage({ name: msg('page-menu.new-page-initial-name'), id: newPageId })
			editor.setCurrentPage(newPageId)
			setIsEditing(true)

			editor.timers.requestAnimationFrame(() => {
				const elm = document.querySelector(`[data-pageid="${newPageId}"]`) as HTMLDivElement
				elm?.querySelector('button')?.focus()
			})
		})
		editor.menus.clearOpenMenus()
		trackEvent('new-page', { source: 'page-menu' })
	}, [editor, msg, isReadonlyMode, trackEvent, user])

	const changePage = useCallback(
		(id: TLPageId) => {
			editor.setCurrentPage(id)
			trackEvent('change-page', { source: 'page-menu' })
		},
		[editor, trackEvent]
	)

	const renamePage = useCallback(
		(id: TLPageId, name: string) => {
			editor.renamePage(id, name)
			trackEvent('rename-page', { source: 'page-menu' })
		},
		[editor, trackEvent]
	)

	// Build a lookup from tldraw page id to PageEntry for share button
	const pageEntryByTldraw = new Map(
		state.context.pages.map((p) => [p.tldrawId, p])
	)

	return (
		<TldrawUiPopover id="pages" onOpenChange={onOpenChange} open={isOpen}>
			<TldrawUiPopoverTrigger data-testid="main.page-menu">
				<TldrawUiButton type="menu" title={currentPage.name} className="tlui-page-menu__trigger">
					<div className="tlui-page-menu__name">{currentPage.name}</div>
					<TldrawUiButtonIcon icon="chevron-down" small />
				</TldrawUiButton>
			</TldrawUiPopoverTrigger>
			<TldrawUiPopoverContent side="bottom" align="start" sideOffset={0} disableEscapeKeyDown={isEditing}>
				<div className="tlui-page-menu__wrapper">
					<div className="tlui-page-menu__header">
						<div className="tlui-page-menu__header__title">{msg('page-menu.title')}</div>
						{!isReadonlyMode && (
							<div className="tlui-buttons__horizontal">
								<TldrawUiButton
									type="icon"
									title={msg(isEditing ? 'page-menu.edit-done' : 'page-menu.edit-start')}
									onClick={toggleEditing}
								>
									<TldrawUiButtonIcon icon={isEditing ? 'check' : 'edit'} />
								</TldrawUiButton>
								<TldrawUiButton
									type="icon"
									title={msg(maxPageCountReached ? 'page-menu.max-page-count-reached' : 'page-menu.create-new-page')}
									disabled={maxPageCountReached}
									onClick={handleCreatePage}
								>
									<TldrawUiButtonIcon icon="plus" />
								</TldrawUiButton>
							</div>
						)}
					</div>
					<div
						className="tlui-page-menu__list tlui-menu__group"
						style={{ height: ITEM_HEIGHT * displayPages.length + 4 }}
						ref={rSortableContainer}
					>
						{displayPages.map((page, index) => {
							const position = sortablePositionItems[page.id] ?? {
								y: index * ITEM_HEIGHT,
								offsetY: 0,
								isSelected: false,
							}
							const entry = pageEntryByTldraw.get(page.id)

							return isEditing ? (
								<div
									key={page.id + '_editing'}
									data-pageid={page.id}
									className="tlui-page_menu__item__sortable"
									style={{
										zIndex: page.id === currentPage.id ? 888 : index,
										transform: `translate(0px, ${position.y + position.offsetY}px)`,
									}}
								>
									<TldrawUiButton
										type="icon"
										tabIndex={-1}
										className="tlui-page_menu__item__sortable__handle"
										onPointerDown={handlePointerDown}
										onPointerUp={handlePointerUp}
										onPointerMove={handlePointerMove}
										onKeyDown={handleKeyDown}
										data-id={page.id}
										data-index={index}
									>
										<TldrawUiButtonIcon icon="drag-handle-dots" />
									</TldrawUiButton>
									{breakpoint < Number(PORTRAIT_BREAKPOINT.TABLET_SM) && isCoarsePointer ? (
										<TldrawUiButton
											type="normal"
											className="tlui-page-menu__item__button"
											onClick={() => {
												const name = window.prompt('Rename page', page.name)
												if (name && name !== page.name) renamePage(page.id, name)
											}}
											onDoubleClick={toggleEditing}
										>
											<TldrawUiButtonCheck checked={page.id === currentPage.id} />
											<TldrawUiButtonLabel>{page.name}</TldrawUiButtonLabel>
										</TldrawUiButton>
									) : (
										<div className="tlui-page_menu__item__sortable__title" style={{ height: ITEM_HEIGHT }}>
											<PageItemInput
												id={page.id}
												name={page.name}
												isCurrentPage={page.id === currentPage.id}
												onComplete={() => setIsEditing(false)}
												onCancel={() => setIsEditing(false)}
											/>
										</div>
									)}
									<SharePageButton pageId={page.id} entry={entry} isLoggedIn={!!user} />
									{!isReadonlyMode && (
										<div className="tlui-page_menu__item__submenu" data-isediting={isEditing}>
											<CustomPageItemSubmenu
												index={index}
												item={page}
												listSize={displayPages.length}
												pages={displayPages}
												entry={entry}
												trackEvent={trackEvent as (name: string, data?: unknown) => void}
											/>
										</div>
									)}
								</div>
							) : (
								<div key={page.id} data-pageid={page.id} className="tlui-page-menu__item">
									<TldrawUiButton
										type="normal"
										className="tlui-page-menu__item__button"
										onClick={() => changePage(page.id)}
										onDoubleClick={toggleEditing}
										title={msg('page-menu.go-to-page')}
										onKeyDown={(e) => {
											if (e.key === 'Enter' && page.id === currentPage.id) {
												toggleEditing()
												stopEventPropagation(e)
											}
										}}
									>
										<TldrawUiButtonCheck checked={page.id === currentPage.id} />
										<TldrawUiButtonLabel>{page.name}</TldrawUiButtonLabel>
									</TldrawUiButton>
									<SharePageButton pageId={page.id} entry={entry} isLoggedIn={!!user} />
									{!isReadonlyMode && (
										<div className="tlui-page_menu__item__submenu">
											<CustomPageItemSubmenu
												index={index}
												item={page}
												listSize={displayPages.length}
												pages={displayPages}
												entry={entry}
												onRename={() => {
													if (tlenv.isIos) {
														const name = window.prompt('Rename page', page.name)
														if (name && name !== page.name) renamePage(page.id, name)
													} else {
														setIsEditing(true)
														if (currentPageId !== page.id) changePage(page.id)
													}
												}}
												trackEvent={trackEvent as (name: string, data?: unknown) => void}
											/>
										</div>
									)}
								</div>
							)
						})}
					</div>
					<div className="tlui-page-menu__footer">
						<OpenSharedLinkPopover />
					</div>
				</div>
			</TldrawUiPopoverContent>
		</TldrawUiPopover>
	)
})
