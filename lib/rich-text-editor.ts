export const RICH_TEXT_EDITOR_MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ align: [] }],
    ['blockquote', 'link'],
    ['clean']
  ]
}

export const RICH_TEXT_EDITOR_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike', 'color', 'background',
  'list', 'indent', 'align', 'blockquote', 'link'
]
