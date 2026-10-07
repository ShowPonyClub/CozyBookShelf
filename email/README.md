# E-mail: bron van waarheid

Alle mails van Tatties delen een skelet in de Flash Sheet-stijl van de app (sinds 2026-10-08): papier `#F2EADB` met een
dubbele inktlijn rond het vel, daarin een flash-kaart `#FFFBF2` (2px inkt `#17130F`, hoekjes 4px, harde schaduw; blijft papier in
donker), het lint-logo `tatties-logo.png` in de kaart, een label smal kapitaal, titel en knop in Ultra (Apple Mail laadt Ultra en
Archivo via Google Fonts; Gmail en Outlook vallen terug op Rockwell/Georgia en de systeem-sans), flash-rood `#B8312A` op de knop met
inktrand, harde inktschaduw en gestikte binnenrand, de punten als Nº1..3 tussen twee inktlijnen, ✦ in de hoeken.
Geen emoji's, geen em-dashes, Brits Engels, merknaam in lopende tekst "Tatties".

**Niet met de hand bewerken:** de mails komen uit `tools/mail/bouw_mails.py` in de Tatties-repo (een skelet, per mail alleen de
inhoud). Tekst of stijl aanpassen = dat script aanpassen en `python tools/mail/bouw_mails.py` draaien.

- `supabase-confirm-signup.html` - Supabase Auth > Email Templates > Confirm sign up (`{{ .ConfirmationURL }}`)
- `supabase-reset-password.html` - Supabase Auth > Email Templates > Reset password (`{{ .ConfirmationURL }}`)
- `resend-beta-launch.html` - kopie van de Resend-template `tatties-beta-launch` (beheerd in Resend; hier als referentie)

Nieuwe mail? Voeg een item toe aan `MAILS` in `bouw_mails.py`.
