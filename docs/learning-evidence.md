# Onderzoeksbasis voor Learn

Onderzoeksstand: 16 november 2026. Gerichte eerste selectie, geen systematische literatuurreview. Alleen peer-reviewed publicaties hieronder als onderbouwing. De PDF blijft het ontwerpvoorstel; deze notitie verandert de PDF of plugin niet.

## Beslisregel

Iedere leerclaim krijgt: bron, onderzoekscontext, bevinding, beperking, onze ontwerpvertaling en een controleerbare voorspelling. Onderscheid **ondersteund in onderzochte context**, **tegengesproken**, **gemengd** en **onvoldoende onderzocht**. Geen bewijs is geen weerlegging. Peer review alleen bepaalt de bewijskracht niet: methode, vergelijking, uitkomstmaat en replicatie tellen mee. Een plausibele toepassing blijft een hypothese totdat zij in onze werkomgeving is getest.

## Eerste bewijsmatrix

| Ontwerpvraag | Peer-reviewed bevinding en beperking | Onze toepassing: nog te toetsen |
|---|---|---|
| Hoe beperken we overbelasting? | Mayer & Moreno (2003), onderzoeksynthese: segmenteren en irrelevante of redundante informatie verminderen zijn onder voorwaarden behulpzaam. Onderzoek met multimedia-uitleg bewijst geen optimale interface voor parallel programmeren; segmenteren kan extra studietijd kosten. | Eén mechanisme per scène, code direct bij het relevante beeld, verdieping op verzoek. Geen wetenschappelijke claim dat exact één regel of drie stappen optimaal is. |
| Codefragmenten zelf aanvullen? | Renkl et al. (2002), drie experimenten: geleidelijk weglaten van uitgewerkte stappen hielp vooral bij vergelijkbare vervolgproblemen (near transfer). Laatste stappen eerst weglaten werkte beter dan eerste stappen eerst. Geen bewijs van algemene CTO-vaardigheid. | Eerst begrijpen, vervolgens vrijwillig één betekenisvolle stap invullen. Oefenkopie, hints op aanvraag en later een gewijzigd probleem. Dit exacte hintontwerp is niet door deze studie gevalideerd. |
| Praktijken achter syntax leren? | Margulieux et al. (2020): 265 beginnende programmeerstudenten; subdoellabels verbeterden quizresultaten en verminderden uitval/onvoldoendes. Gemiddelde examenprestaties waren niet significant beter. | Benoem bijvoorbeeld ‘identiteit controleren’ en ‘toegang bepalen’. Meet of gebruikers dezelfde redenering in andere code herkennen. |
| Antwoord en uitleg direct tonen? | Shute (2008), review: feedback moet specifiek en bruikbaar zijn; timing en informatiediepte hangen af van taak en voorkennis. ‘Direct is altijd beter’ volgt hier niet uit. | Bij gestarte mini-oefeningen direct resultaat, concrete fout, referentieoplossing en waarom. Vergelijk correcte alternatieven op gedrag, niet op identieke tekst. |
| Blijft visueel bekijken voldoende? | Karpicke & Blunt (2011): actief ophalen verbeterde uitgestelde begrips-/transfertoetsen ten opzichte van concept mapping in experimenten met wetenschappelijke teksten. Geen bewijs dat productkaarten nutteloos zijn of dat het effect gelijk is bij programmeren. | Vrijwillig voorspellen, aanvullen of verklaren; later zelfstandig een nieuw geval oplossen. Een bekeken kaart of positieve rating telt niet als beheersing. |
| Dezelfde uitleg voor ieder niveau? | Kalyuga et al. (2003), review: ondersteuning kan met toenemende voorkennis redundant worden en voordeel verliezen of nadelig uitpakken. | Hulp per concept afbouwen op basis van aangetoonde toepassing. Geen algemeen ‘senior’-label op basis van gebruiksduur. |
| Moet alles bewegen? | Tversky et al. (2002), review: animatie is niet vanzelf beter; inhoudsverschillen en interactie bemoeilijken vergelijkingen. Vluchtige beweging kan begrip hinderen. | Rustige, bestuurbare stappen; beweging alleen als zij het mechanisme verduidelijkt. RAM-winst van onze uitvoering apart meten. |
| ‘Visuele leerder’ als diagnose? | Pashler et al. (2008), review: onvoldoende bewijs voor betere leerprestaties door instructie te matchen aan vastgestelde leerstijlen. Dat ontkent geen persoonlijke presentatievoorkeur. | Visueel ontwerpen vanwege gebruikersbehoefte en taak; effect toetsen op begrip en zelfstandig toepassen. Geen leerstijltest of leerbelofte. |

## Compact oefenvoorstel

Visueel mechanisme → uitgewerkte code → vrijwillig één relevante stap aanvullen → eventueel een begriphint, daarna een concretere hint → controleren → uitslag, oplossing en korte reden → later optioneel een andere toepassing. Geen gaten in werkende productbestanden; niets blokkeert de bouwagent. De specifieke volgorde, hoeveelheid hints en tijdskosten zijn ontwerpkeuzes, geen bewezen totaalpakket.

## Wat papers niet voor ons aantonen

- Junior → Senior → CTO in 1–2 jaar, betere agentcode en diepgaande stackbeheersing zijn onbewezen productambities.
- Precies deze kleuren, vormen, autozoom en codehoeveelheid zijn nog niet onderbouwd. Ze blijven ontwerpkeuzes totdat passend onderzoek of gebruikstests hun effect ondersteunen.
- ≤5% extra tokens, laag RAM, actualiteit en ontwikkelsnelheid zijn technische/gebruiksacceptatie-eisen. Meten in onze implementatie, inclusief leestijd, afleiding, extra context en herstelwerk; niet afleiden uit leeronderzoek.
- Geen automatisch oefenen omdat oefenen leerzaam kan zijn. De toegevoegde leerwinst moet opwegen tegen de aandacht en tijd die het kost.
- De eerder bekeken arXiv-preprint *How AI Impacts Skill Formation* is hier uitgesloten als peer-reviewed onderbouwing; die status is niet vastgesteld.

Validatievoorstel: vergelijk met de bestaande workflow op vergelijkbare taken, wissel de volgorde af en gebruik andere toetsitems om herhalingseffecten te beperken. Meet zelfstandig verklaren/debuggen en uitgestelde toepassing op nieuwe gevallen naast bouwtijd, aandacht, tokens en RAM. Leg vooraf uitkomstmaten en stopcriteria vast; een prettige presentatie is geen bewijs van leren.

## Referenties

1. Mayer, R. E., & Moreno, R. (2003). *Nine Ways to Reduce Cognitive Load in Multimedia Learning*. Educational Psychologist, 38(1), 43–52. [DOI](https://doi.org/10.1207/S15326985EP3801_6).
2. Renkl, A., Atkinson, R. K., Maier, U. H., & Staley, R. (2002). *From Example Study to Problem Solving: Smooth Transitions Help Learning*. The Journal of Experimental Education, 70(4), 293–315. [DOI](https://doi.org/10.1080/00220970209599510).
3. Margulieux, L. E., Morrison, B. B., & Decker, A. (2020). *Reducing withdrawal and failure rates in introductory programming with subgoal labeled worked examples*. International Journal of STEM Education, 7, 19. [Artikel](https://link.springer.com/article/10.1186/s40594-020-00222-7).
4. Shute, V. J. (2008). *Focus on Formative Feedback*. Review of Educational Research, 78(1), 153–189. [DOI](https://doi.org/10.3102/0034654307313795).
5. Karpicke, J. D., & Blunt, J. R. (2011). *Retrieval Practice Produces More Learning than Elaborative Studying with Concept Mapping*. Science, 331(6018), 772–775. [DOI](https://doi.org/10.1126/science.1199327).
6. Kalyuga, S., Ayres, P., Chandler, P., & Sweller, J. (2003). *The Expertise Reversal Effect*. Educational Psychologist, 38(1), 23–31. [DOI](https://doi.org/10.1207/S15326985EP3801_4).
7. Tversky, B., Morrison, J. B., & Bétrancourt, M. (2002). *Animation: can it facilitate?* International Journal of Human-Computer Studies, 57(4), 247–262. [DOI](https://doi.org/10.1006/ijhc.1017).
8. Pashler, H., McDaniel, M., Rohrer, D., & Bjork, R. (2008). *Learning Styles: Concepts and Evidence*. Psychological Science in the Public Interest, 9(3), 105–119. [DOI](https://doi.org/10.1111/j.1539-6053.2009.01038.x).
