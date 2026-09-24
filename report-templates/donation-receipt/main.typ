#let data = json("data.json")
#let organization = data.at("organization")
#let family = data.at("family")
#let amounts = data.at("amounts")

#set page(paper: "us-letter", margin: 0.7in)
#set text(font: "Libertinus Serif", size: 10pt, fill: rgb("243044"))

#align(right)[#text(size: 19pt, weight: "bold", fill: rgb("7b4a8f"))[#data.at("title")]#linebreak()Issued #data.at("issueDate")]
#text(size: 16pt, weight: "bold")[#organization.at("name")]
#if organization.at("address") != "" [#linebreak()#organization.at("address")]
#if organization.at("contact") != "" [#linebreak()#organization.at("contact")]

#v(22pt)
#text(size: 14pt, weight: "bold")[Thank you for supporting the DVCLC Scholarship Fund.]
#v(14pt)
#table(
  columns: (1fr, auto), inset: 9pt,
  stroke: (x: none, y: 0.5pt + rgb("d9e0e8")),
  [Donor family], align(right)[#family.at("name")],
  [Donation amount], align(right)[#amounts.at("paid")],
  [Balance], align(right)[\$0.00],
)
#if family.at("guardians") != "" [#v(10pt)*Guardians:* #family.at("guardians")]
#if data.at("footer") != "" [#v(24pt)#box(fill: rgb("f7f2f9"), inset: 12pt, radius: 4pt, width: 100%)[#data.at("footer")]]
