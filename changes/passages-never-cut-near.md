# Passages between styles never cut off nearby

- The field looked for the passages between styles only among the regions of other styles up to 280 m (blend distance) from a point, and only for passages from the point's own region. So where a style carried a passage's end deep into its region, or where a point stepped from one region into the next of the same style, a passage's air dropped out of the field a few metres from it. Deep in the rock, but the field jumped there (and a mesh chunk next to it could have been skipped).
- Now each region keeps a list of every passage near it, whichever regions it runs between (`Regions.regionsRound` finds the regions round a point), so a passage drops out only hundreds of metres off, deep in rock.
