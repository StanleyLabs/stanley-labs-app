/**
 * Page menu with share icon for pages linked to a shared URL.
 */

import type { TLPageId } from '@tldraw/tlschema'
import { stopEventPropagation, tlenv, useEditor, useValue } from '@tldraw/editor'
import { memo, useCallback, useEffect, useState } from 'react'
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

	const [isEditing, setIsEditing] = useState(false)
	const handleOpenChange = useCallback(() => setIsEditing(false), [])

	const [isOpen, onOpenChange] = useMenuIsOpen('page-menu', handleOpenChange)
	const { user } = useAuth()

	const ITEM_HEIGHT = 36

	const pages = useValue('pages', () => editor.getPages(), [editor])
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
		function closePageMenuOnEnterPressAfterPressingEnterToConfirmRename() {
			function handleKeyDown() {
				if (isEditing) return
				if (document.activeElement === document.body) {
					editor.menus.clearOpenMenus()
				}
			}

			document.addEventListener('keydown', handleKeyDown, { passive: true })
			return () => {
				document.removeEventListener('keydown', handleKeyDown)
			}
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
	} = useSortablePages(pages, ITEM_HEIGHT, editor, trackEvent as (name: string, data?: unknown) => void)

	useEffect(() => {
		if (!isOpen) return
		if (user) window.dispatchEvent(new Event('whiteboard-cloud-refresh'))
		editor.timers.requestAnimationFrame(() => {
			const elm = document.querySelector(`[data-pageid="${currentPageId}"]`) as HTMLDivElement

			if (elm) {
				elm.querySelector('button')?.focus()

				const container = rSortableContainer.current
				if (!container) return

				const elmTopPosition = elm.offsetTop
				const containerScrollTopPosition = container.scrollTop
				if (elmTopPosition < containerScrollTopPosition) {
					container.scrollTo({ top: elmTopPosition })
				}
				const elmBottomPosition = elmTopPosition + ITEM_HEIGHT
				const containerScrollBottomPosition = container.scrollTop + container.offsetHeight
				if (elmBottomPosition > containerScrollBottomPosition) {
					container.scrollTo({ top: elmBottomPosition - container.offsetHeight })
				}
			}
		})
	}, [ITEM_HEIGHT, currentPageId, isOpen, editor, rSortableContainer])

	const handleCreatePageClick = useCallback(() => {
		if (isReadonlyMode) return

		if (user) {
			// v2: create page in DB first, then create locally with the DB-generated tldraw_page_id.
			void (async () => {
				const { createPage } = await import('./v2/pagesApi')
				const pageName = msg('page-menu.new-page-initial-name')
				const newPage = await createPage({ title: pageName })
				if (!newPage?.tldraw_page_id) return

				editor.run(() => {
					editor.markHistoryStoppingPoint('creating page')
					editor.createPage({ name: pageName, id: newPage.tldraw_page_id as any })
					editor.setCurrentPage(newPage.tldraw_page_id as any)
					setIsEditing(true)
				})

				editor.timers.requestAnimationFrame(() => {
					const elm = document.querySelector(`[data-pageid="${newPage.tldraw_page_id}"]`) as HTMLDivElement
					if (elm) elm.querySelector('button')?.focus()
				})

				// Notify the workspace hook to update its mapping.
				window.dispatchEvent(new Event('v2-pages-changed'))
				editor.menus.clearOpenMenus()
				trackEvent('new-page', { source: 'page-menu' })
			})()
			return
		}

		// Guest: create locally as before.
		editor.run(() => {
			editor.markHistoryStoppingPoint('creating page')
			const newPageId = PageRecordType.createId()
			editor.createPage({ name: msg('page-menu.new-page-initial-name'), id: newPageId })
			editor.setCurrentPage(newPageId)

			setIsEditing(true)

			editor.timers.requestAnimationFrame(() => {
				const elm = document.querySelector(`[data-pageid="${newPageId}"]`) as HTMLDivElement

				if (elm) {
					elm.querySelector('button')?.focus()
				}
			})
		})
		editor.menus.clearOpenMenus()
		trackEvent('new-page', { source: 'page-menu' })
	}, [editor, msg, isReadonlyMode, trackEvent])

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
			if (user) window.dispatchEvent(new Event('whiteboard-cloud-flush'))
			trackEvent('rename-page', { source: 'page-menu' })
		},
		[editor, trackEvent, user]
	)

	return (
		<TldrawUiPopover id="pages" onOpenChange={onOpenChange} open={isOpen}>
			<TldrawUiPopoverTrigger data-testid="main.page-menu">
				<TldrawUiButton
					type="menu"
					title={currentPage.name}
					data-testid="page-menu.button"
					className="tlui-page-menu__trigger"
				>
					<div className="tlui-page-menu__name">{currentPage.name}</div>
					<TldrawUiButtonIcon icon="chevron-down" small />
				</TldrawUiButton>
			</TldrawUiPopoverTrigger>
			<TldrawUiPopoverContent
				side="bottom"
				align="start"
				sideOffset={0}
				disableEscapeKeyDown={isEditing}
			>
				<div className="tlui-page-menu__wrapper">
					<div className="tlui-page-menu__header">
						<div className="tlui-page-menu__header__title">{msg('page-menu.title')}</div>
						{!isReadonlyMode && (
							<div className="tlui-buttons__horizontal">
								<TldrawUiButton
									type="icon"
									data-testid="page-menu.edit"
									title={msg(isEditing ? 'page-menu.edit-done' : 'page-menu.edit-start')}
									onClick={toggleEditing}
								>
									<TldrawUiButtonIcon icon={isEditing ? 'check' : 'edit'} />
								</TldrawUiButton>
								<TldrawUiButton
									type="icon"
									data-testid="page-menu.create"
									title={msg(
										maxPageCountReached
											? 'page-menu.max-page-count-reached'
											: 'page-menu.create-new-page'
									)}
									disabled={maxPageCountReached}
									onClick={handleCreatePageClick}
								>
									<TldrawUiButtonIcon icon="plus" />
								</TldrawUiButton>
							</div>
						)}
					</div>
					<div
						data-testid="page-menu.list"
						className="tlui-page-menu__list tlui-menu__group"
						style={{ height: ITEM_HEIGHT * pages.length + 4 }}
						ref={rSortableContainer}
					>
						{pages.map((page, index) => {
							const position = sortablePositionItems[page.id] ?? {
								y: index * ITEM_HEIGHT,
								offsetY: 0,
								isSelected: false,
							}

							return isEditing ? (
								<div
									key={page.id + '_editing'}
									data-testid="page-menu.item"
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
												if (name && name !== page.name) {
													renamePage(page.id, name)
												}
											}}
											onDoubleClick={toggleEditing}
										>
											<TldrawUiButtonCheck checked={page.id === currentPage.id} />
											<TldrawUiButtonLabel>{page.name}</TldrawUiButtonLabel>
										</TldrawUiButton>
									) : (
										<div
											className="tlui-page_menu__item__sortable__title"
											style={{ height: ITEM_HEIGHT }}
										>
											<PageItemInput
												id={page.id}
												name={page.name}
												isCurrentPage={page.id === currentPage.id}
												onComplete={() => setIsEditing(false)}
												onCancel={() => setIsEditing(false)}
											/>
										</div>
									)}
									<SharePageButton pageId={page.id} />
									{!isReadonlyMode && (
										<div className="tlui-page_menu__item__submenu" data-isediting={isEditing}>
											<CustomPageItemSubmenu
												index={index}
												item={page}
												listSize={pages.length}
												pages={pages}
												trackEvent={trackEvent as (name: string, data?: unknown) => void}
											/>
										</div>
									)}
								</div>
							) : (
								<div
									key={page.id}
									data-pageid={page.id}
									data-testid="page-menu.item"
									className="tlui-page-menu__item"
								>
									<TldrawUiButton
										type="normal"
										className="tlui-page-menu__item__button"
										onClick={() => changePage(page.id)}
										onDoubleClick={toggleEditing}
										title={msg('page-menu.go-to-page')}
										onKeyDown={(e) => {
											if (e.key === 'Enter') {
												if (page.id === currentPage.id) {
													toggleEditing()
													stopEventPropagation(e)
												}
											}
										}}
									>
										<TldrawUiButtonCheck checked={page.id === currentPage.id} />
										<TldrawUiButtonLabel>{page.name}</TldrawUiButtonLabel>
									</TldrawUiButton>
									<SharePageButton pageId={page.id} />
									{!isReadonlyMode && (
										<div className="tlui-page_menu__item__submenu">
											<CustomPageItemSubmenu
												index={index}
												item={page}
												listSize={pages.length}
												pages={pages}
												onRename={() => {
													if (tlenv.isIos) {
														const name = window.prompt('Rename page', page.name)
														if (name && name !== page.name) {
															renamePage(page.id, name)
														}
													} else {
														setIsEditing(true)
														if (currentPageId !== page.id) {
															changePage(page.id)
														}
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
