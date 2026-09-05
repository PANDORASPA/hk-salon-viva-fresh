export default function PageIntro({ eyebrow, title, children }) {
  return <header className="salon-page-intro"><p className="salon-kicker">{eyebrow}</p><h1>{title}</h1>{children ? <div className="salon-lead">{children}</div> : null}</header>
}
