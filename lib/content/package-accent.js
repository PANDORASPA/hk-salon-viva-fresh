// Array positions, not persisted IDs, are used in selectors. Only hex colours
// can enter this nonce-authorised stylesheet, never arbitrary CSS or HTML.
export function packageAccentCss(packages) {
  return packages.map((item, index) => {
    const colour = /^#[0-9a-f]{6}$/i.test(item.colour_hex || '') ? item.colour_hex : '#a98152'
    return '.package-accent-' + index + '{border-left-color:' + colour + '}'
  }).join('')
}
