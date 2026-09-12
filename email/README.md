# E-mail: bron van waarheid

Alle mails van Tatties delen een skelet: papier `#EFE4D0`, kaart `#FBF7EE` met rand `#D9CBB3` (radius 12),
kop in Georgia (Recoleta-stand-in; mailclients strippen webfonts), tekst in de systeem-sans, het ene rood
`#CE2727` op de knop met een letterpress-rand (`border` 2px `#8E1B1B`, rechts en onder 5px = de harde
schaduw van de app), logo als gehoste badge `tatties-logo-email.png` (dark-safe). Geen emoji's, geen em-dashes,
Brits Engels, merknaam in lopende tekst "Tatties" (kleine letters alleen woordmerk, tagline en domein).

- `supabase-confirm-signup.html` - Supabase Auth > Email Templates > Confirm sign up (`{{ .ConfirmationURL }}`)
- `supabase-reset-password.html` - Supabase Auth > Email Templates > Reset password (`{{ .ConfirmationURL }}`)
- `resend-beta-launch.html` - kopie van de Resend-template `tatties-beta-launch` (beheerd in Resend; hier als referentie)

Nieuwe mail? Kopieer een van deze bestanden en vervang alleen kop, alinea's, knop en het informatieblok.
