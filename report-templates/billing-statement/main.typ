#let data = json("data.json")
#let organization = data.at("organization")
#let family = data.at("family")
#let session = data.at("session")
#let amounts = data.at("amounts")

#set page(paper: "us-letter", margin: 0.7in)
#set text(font: "Libertinus Serif", size: 10pt, fill: rgb("243044"))

#align(right)[#text(size: 19pt, weight: "bold", fill: rgb("256b55"))[#data.at("title")]#linebreak()Issued #data.at("issueDate")]
#text(size: 16pt, weight: "bold")[#organization.at("name")]
#if organization.at("address") != "" [#linebreak()#organization.at("address")]
#if organization.at("contact") != "" [#linebreak()#organization.at("contact")]

#v(18pt)
#box(fill: rgb("f1f8f5"), inset: 12pt, radius: 4pt, width: 100%)[
  *Family:* #family.at("name")#linebreak()
  #if family.at("guardians") != "" [#family.at("guardians")#linebreak()]
  *Session:* #session.at("name")
]

#v(18pt)
#table(
  columns: (1fr, auto), inset: 9pt,
  stroke: (x: none, y: 0.5pt + rgb("d9e0e8")),
  [Registration total], align(right)[#amounts.at("total")],
  [Amount paid], align(right)[#amounts.at("paid")],
  text(weight: "bold")[Remaining balance], align(right)[#text(weight: "bold")[#amounts.at("balance")]],
)
#if data.at("footer") != "" [#v(24pt)#box(stroke: 0.5pt + rgb("d9e0e8"), inset: 10pt, width: 100%)[#data.at("footer")]]
