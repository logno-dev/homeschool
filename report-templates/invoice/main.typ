#let data = json("data.json")
#let organization = data.at("organization")
#let family = data.at("family")
#let session = data.at("session")
#let amounts = data.at("amounts")

#set page(paper: "us-letter", margin: 0.7in)
#set text(font: "Libertinus Serif", size: 10pt, fill: rgb("243044"))
#set par(leading: 0.65em)

#align(right)[
  #text(size: 19pt, weight: "bold", fill: rgb("174f3a"))[#data.at("title")]
  #v(4pt)
  Issued #data.at("issueDate")
]

#text(size: 16pt, weight: "bold")[#organization.at("name")]
#if organization.at("address") != "" [#linebreak()#organization.at("address")]
#if organization.at("contact") != "" [#linebreak()#organization.at("contact")]

#v(18pt)
#box(fill: rgb("f3f6fa"), inset: 12pt, radius: 4pt, width: 100%)[
  *Bill to* #h(1fr) *Session*#linebreak()
  #family.at("name") #h(1fr) #session.at("name")
  #if family.at("guardians") != "" [#linebreak()#family.at("guardians")]
]

#v(18pt)
#table(
  columns: (1fr, auto),
  inset: 9pt,
  stroke: (x: none, y: 0.5pt + rgb("d9e0e8")),
  [Registration total], align(right)[#amounts.at("total")],
  [Amount paid], align(right)[#amounts.at("paid")],
  text(weight: "bold")[Balance due], align(right)[#text(weight: "bold", fill: rgb("174f3a"))[#amounts.at("balance")]],
)

#if data.at("dueDate") != "" [#v(12pt)*Due date:* #data.at("dueDate")]
#if data.at("footer") != "" [#v(24pt)#box(stroke: 0.5pt + rgb("d9e0e8"), inset: 10pt, width: 100%)[#data.at("footer")]]
