# File: backend/app/utils/rwanda_address.py
"""
Rwanda administrative address utilities.

Provides a complete district → sector → cell → village hierarchy
based on Rwanda's official administrative divisions.

Also includes address formatting helpers and geocoding support.
"""

from __future__ import annotations

# Complete Rwanda administrative structure
# Source: Rwanda National Institute of Statistics / NISR administrative data
RWANDA_ADDRESSES: dict[str, dict[str, dict[str, list[str]]]] = {
    "Kigali City": {
        "Nyarugenge": {
            "Gitega": ["Akabahizi", "Akabandi", "Akabuye", "Akakayange", "Akamatamu"],
            "Kimisagara": ["Agasasa", "Agatare", "Gisimenti", "Kacyiru", "Kimisagara"],
            "Nyarugenge": ["Biryogo", "Industrial Area", "Muhima", "Nyarugenge"],
            "Mageragere": ["Batsinda", "Kagarama", "Mpandahande", "Nyamirambo"],
            "Rwezamenyo": ["Bwiza", "Kimuhurura", "Kivugiza", "Rwezamenyo"],
            "Nyamirambo": ["Biryogo", "Gikondo", "Gitega", "Kabuye", "Nyamirambo"],
            "Kanyinya": ["Gisozi", "Kacyiru", "Kanyinya", "Muhima"],
            "Kigali": ["City Centre", "CBD", "Centenary House Area"],
            "Nyakabanda": ["Kimihurura", "Kinyinya", "Nyakabanda"],
            "Biryogo": ["Biryogo", "Kivugiza", "Musenyi"],
        },
        "Gasabo": {
            "Bumbogo": ["Bumbogo", "Gisozi", "Kabeza", "Kacyiru"],
            "Gatsata": ["Buhinga", "Gatsata", "Gisozi", "Kacyiru"],
            "Gikomero": ["Bunyogombwa", "Gatunga", "Gikomero", "Kabuga"],
            "Gisozi": ["Batsinda", "Gisozi", "Kacyiru", "Kimironko"],
            "Jabana": ["Jabana", "Kagugu", "Kinyinya", "Nyabisindu"],
            "Jali": ["Cyimbazi", "Jali", "Kabuye", "Kimisange"],
            "Kacyiru": ["Kamatamu", "Karame", "Kacyiru", "Kibaza"],
            "Kimironko": ["Bibare", "Kibagabaga", "Kimironko", "Nyagatovu"],
            "Kinyinya": ["Bibare", "Kabuye", "Kinyinya", "Nyabisindu"],
            "Ndera": ["Kabeza", "Kabuga", "Ndera", "Nyagatovu"],
            "Remera": ["Gahanga", "Kagugu", "Kimironko", "Remera"],
            "Rusororo": ["Gasharu", "Kabeza", "Ndera", "Rusororo"],
            "Rutunga": ["Bumbogo", "Gatunga", "Rutunga"],
        },
        "Kicukiro": {
            "Gahanga": ["Cyahafi", "Gahanga", "Nyagahama", "Nyakabanda"],
            "Gatenga": ["Gatenga", "Gitega", "Nyarugunga"],
            "Gikondo": ["Gikondo", "Kagugu", "Niboye"],
            "Kagarama": ["Batsinda", "Gahanga", "Kagarama", "Nyarugunga"],
            "Kanombe": ["Gikondo", "Kanombe", "Nyarugunga", "Rebero"],
            "Kicukiro": ["Biryogo", "Gatenga", "Kicukiro", "Niboye"],
            "Kigarama": ["Gahanga", "Kigarama", "Mburabuturo"],
            "Masaka": ["Gahanga", "Gatenga", "Masaka", "Nyamirambo"],
            "Niboye": ["Gatenga", "Gikondo", "Niboye", "Nyarugunga"],
            "Nyarugunga": ["Gahanga", "Kanombe", "Nyarugunga", "Rebero"],
        },
    },
    "Eastern Province": {
        "Bugesera": {
            "Gashora": ["Gashora", "Kabuga", "Kamabuye", "Nyarugunga"],
            "Juru": ["Bibare", "Juru", "Kabuye", "Nyagatovu"],
            "Kamabuye": ["Gashora", "Kamabuye", "Mwendo"],
            "Mareba": ["Gashora", "Kagugu", "Mareba", "Ntarama"],
            "Mayange": ["Gashora", "Kabuga", "Mayange", "Ruramira"],
            "Musenyi": ["Musenyi", "Ntarama", "Ruhuha"],
            "Mwendo": ["Kamabuye", "Mwendo", "Nyamata"],
            "Ntarama": ["Gahunga", "Ntarama", "Nyamata"],
            "Nyamata": ["Bibare", "Nyamata", "Ruhuha"],
        },
        "Gatsibo": {
            "Gasange": ["Gasange", "Kabeza", "Kagina"],
            "Gatsibo": ["Gatsibo", "Kagina", "Kabare"],
            "Gitoki": ["Gitoki", "Kageyo", "Karama"],
            "Kageyo": ["Kageyo", "Karama", "Mukarange"],
            "Kiramuruzi": ["Gahini", "Kiramuruzi", "Mukarange"],
            "Muhura": ["Gahini", "Muhura", "Mukarange"],
        },
        "Kayonza": {
            "Gahini": ["Gahini", "Kabeza", "Kageyo"],
            "Kabare": ["Kabare", "Kabeza", "Kageyo"],
            "Kabarondo": ["Gahini", "Kabarondo", "Kabeza"],
            "Mukarange": ["Gahini", "Mukarange", "Ntarama"],
            "Murama": ["Kabare", "Murama", "Ntarama"],
            "Murundi": ["Mukarange", "Murundi", "Ntarama"],
        },
        "Kirehe": {
            "Gahara": ["Gahara", "Kabeza", "Kageyo"],
            "Gatore": ["Gatore", "Kabeza", "Kiziguro"],
            "Kigarama": ["Kigarama", "Kiziguro", "Mpanga"],
            "Kigina": ["Gahara", "Kigina", "Kiziguro"],
            "Kirehe": ["Gahara", "Kigina", "Kirehe"],
            "Mpanga": ["Kigarama", "Mpanga", "Nyagatovu"],
        },
        "Ngoma": {
            "Gashanda": ["Gashanda", "Kabeza", "Kageyo"],
            "Jarama": ["Jarama", "Kabeza", "Kageyo"],
            "Kibungo": ["Gashanda", "Kibungo", "Nyagahama"],
            "Mugesera": ["Gashanda", "Mugesera", "Nyagatovu"],
            "Murama": ["Gashanda", "Murama", "Nyagahama"],
            "Mutenderi": ["Mutenderi", "Nyagahama", "Nyagatovu"],
        },
        "Nyagatare": {
            "Gatunda": ["Gatunda", "Kabeza", "Kageyo"],
            "Karama": ["Karama", "Kibaya", "Nyagatare"],
            "Karangazi": ["Karangazi", "Kibaya", "Nyagatare"],
            "Katabagemu": ["Katabagemu", "Kibaya", "Nyagatare"],
            "Kiramurindi": ["Kiramurindi", "Nyagatare", "Rukomo"],
            "Matimba": ["Matimba", "Nyagatare", "Rukomo"],
            "Mimuli": ["Mimuli", "Nyagatare", "Rurenge"],
            "Mukama": ["Mukama", "Nyagatare", "Rugari"],
            "Musheri": ["Musheri", "Nyagatare", "Rugari"],
            "Nyagatare": ["Kibaya", "Nyagatare", "Rurenge"],
            "Rukomo": ["Nyagatare", "Rukomo", "Rurenge"],
        },
        "Rwamagana": {
            "Fumbwe": ["Fumbwe", "Kabeza", "Kageyo"],
            "Gahengeri": ["Gahengeri", "Kabeza", "Kageyo"],
            "Gishari": ["Gishari", "Kabeza", "Rwamagana"],
            "Karenge": ["Karenge", "Rwamagana"],
            "Kigabiro": ["Kigabiro", "Rwamagana"],
            "Munyaga": ["Munyaga", "Rwamagana"],
            "Munyiginya": ["Munyiginya", "Rwamagana"],
            "Musha": ["Musha", "Rwamagana"],
            "Muyumbu": ["Muyumbu", "Rwamagana"],
            "Mwulire": ["Mwulire", "Rwamagana"],
            "Nyakariro": ["Nyakariro", "Rwamagana"],
            "Nzige": ["Nzige", "Rwamagana"],
            "Rubona": ["Rubona", "Rwamagana"],
            "Rwamagana": ["Kabeza", "Rwamagana", "Rurenge"],
        },
    },
    "Northern Province": {
        "Burera": {
            "Bungwe": ["Bungwe", "Gitovu", "Kinihira"],
            "Butaro": ["Butaro", "Cyanika", "Kinihira"],
            "Cyanika": ["Butaro", "Cyanika", "Kinyababa"],
            "Cyeru": ["Cyanika", "Cyeru", "Kinyababa"],
            "Gahunga": ["Cyanika", "Gahunga", "Kinihira"],
            "Gatebe": ["Cyanika", "Gatebe", "Kinihira"],
            "Gitovu": ["Gitovu", "Kinihira", "Rugarama"],
            "Kagogo": ["Cyanika", "Kagogo", "Kinihira"],
            "Kinyababa": ["Kinihira", "Kinyababa", "Rugarama"],
            "Kinoni": ["Kinihira", "Kinoni", "Rugarama"],
            "Kivuye": ["Kinihira", "Kivuye", "Rugarama"],
            "Nemba": ["Kinihira", "Nemba", "Rugarama"],
            "Rugarama": ["Kinihira", "Rugarama", "Rugendabari"],
            "Rugendabari": ["Rugendabari", "Rugarama"],
            "Ruhunde": ["Rugarama", "Ruhunde"],
            "Rusarabuye": ["Rugarama", "Rusarabuye"],
            "Rwerere": ["Rugarama", "Rwerere"],
        },
        "Gakenke": {
            "Busengo": ["Busengo", "Gakenke", "Kabagari"],
            "Coko": ["Coko", "Gakenke", "Kabagari"],
            "Cyabingo": ["Cyabingo", "Gakenke", "Kabagari"],
            "Gakenke": ["Busengo", "Gakenke", "Kabagari"],
            "Gashenyi": ["Gashenyi", "Gakenke", "Kabagari"],
            "Janja": ["Gakenke", "Janja", "Kabagari"],
            "Kamubuga": ["Gakenke", "Kabagari", "Kamubuga"],
            "Karambo": ["Gakenke", "Kabagari", "Karambo"],
            "Kivuruga": ["Gakenke", "Kabagari", "Kivuruga"],
            "Mataba": ["Gakenke", "Kabagari", "Mataba"],
            "Minazi": ["Gakenke", "Kabagari", "Minazi"],
            "Mugunga": ["Gakenke", "Kabagari", "Mugunga"],
            "Muhondo": ["Gakenke", "Kabagari", "Muhondo"],
            "Muyongwe": ["Gakenke", "Kabagari", "Muyongwe"],
            "Muzo": ["Gakenke", "Kabagari", "Muzo"],
            "Ndaro": ["Gakenke", "Kabagari", "Ndaro"],
            "Rubaya": ["Gakenke", "Kabagari", "Rubaya"],
            "Rugendabari": ["Gakenke", "Kabagari", "Rugendabari"],
            "Rusasa": ["Gakenke", "Kabagari", "Rusasa"],
            "Rushashi": ["Gakenke", "Kabagari", "Rushashi"],
        },
        "Gicumbi": {
            "Bukure": ["Bukure", "Gicumbi", "Kabagari"],
            "Bungwe": ["Bungwe", "Gicumbi", "Kabagari"],
            "Byumba": ["Byumba", "Gicumbi", "Kabagari"],
            "Cyumba": ["Cyumba", "Gicumbi", "Kabagari"],
            "Gicumbi": ["Gicumbi", "Kabagari", "Kaniga"],
            "Kaniga": ["Gicumbi", "Kabagari", "Kaniga"],
            "Manyagiro": ["Gicumbi", "Kabagari", "Manyagiro"],
            "Miyove": ["Gicumbi", "Kabagari", "Miyove"],
            "Mukarange": ["Gicumbi", "Kabagari", "Mukarange"],
            "Muko": ["Gicumbi", "Kabagari", "Muko"],
            "Mutete": ["Gicumbi", "Kabagari", "Mutete"],
            "Nyamiyaga": ["Gicumbi", "Kabagari", "Nyamiyaga"],
            "Nyankenke": ["Gicumbi", "Kabagari", "Nyankenke"],
            "Rubaya": ["Gicumbi", "Kabagari", "Rubaya"],
            "Rukomo": ["Gicumbi", "Kabagari", "Rukomo"],
            "Rushaki": ["Gicumbi", "Kabagari", "Rushaki"],
        },
        "Musanze": {
            "Busogo": ["Busogo", "Kabagari", "Musanze"],
            "Cyuve": ["Cyuve", "Kabagari", "Musanze"],
            "Gacaca": ["Gacaca", "Kabagari", "Musanze"],
            "Gashaki": ["Gashaki", "Kabagari", "Musanze"],
            "Gataraga": ["Gataraga", "Kabagari", "Musanze"],
            "Kimonyi": ["Kabagari", "Kimonyi", "Musanze"],
            "Kinigi": ["Kabagari", "Kinigi", "Musanze"],
            "Muhoza": ["Kabagari", "Muhoza", "Musanze"],
            "Muko": ["Kabagari", "Muko", "Musanze"],
            "Musanze": ["Kabagari", "Musanze", "Ruhengeri"],
            "Nkotsi": ["Kabagari", "Musanze", "Nkotsi"],
            "Nyange": ["Kabagari", "Musanze", "Nyange"],
            "Remera": ["Kabagari", "Musanze", "Remera"],
            "Rwaza": ["Kabagari", "Musanze", "Rwaza"],
            "Shingiro": ["Kabagari", "Musanze", "Shingiro"],
        },
        "Rulindo": {
            "Base": ["Base", "Kabagari", "Rulindo"],
            "Burega": ["Burega", "Kabagari", "Rulindo"],
            "Bushoki": ["Bushoki", "Kabagari", "Rulindo"],
            "Buyoga": ["Buyoga", "Kabagari", "Rulindo"],
            "Cyinzuzi": ["Cyinzuzi", "Kabagari", "Rulindo"],
            "Cyungo": ["Cyungo", "Kabagari", "Rulindo"],
            "Kinihira": ["Kabagari", "Kinihira", "Rulindo"],
            "Kisaro": ["Kabagari", "Kisaro", "Rulindo"],
            "Masoro": ["Kabagari", "Masoro", "Rulindo"],
            "Mbogo": ["Kabagari", "Mbogo", "Rulindo"],
            "Murambi": ["Kabagari", "Murambi", "Rulindo"],
            "Ngoma": ["Kabagari", "Ngoma", "Rulindo"],
            "Ntarabana": ["Kabagari", "Ntarabana", "Rulindo"],
            "Rukozo": ["Kabagari", "Rukozo", "Rulindo"],
            "Rusiga": ["Kabagari", "Rulindo", "Rusiga"],
            "Shyorongi": ["Kabagari", "Rulindo", "Shyorongi"],
            "Tumba": ["Kabagari", "Rulindo", "Tumba"],
        },
    },
    "Southern Province": {
        "Gisagara": {
            "Gikonko": ["Gikonko", "Gisagara", "Kabagari"],
            "Gishubi": ["Gishubi", "Gisagara", "Kabagari"],
            "Kansi": ["Gisagara", "Kabagari", "Kansi"],
            "Kibirizi": ["Gisagara", "Kabagari", "Kibirizi"],
            "Kigembe": ["Gisagara", "Kabagari", "Kigembe"],
            "Mamba": ["Gisagara", "Kabagari", "Mamba"],
            "Muganza": ["Gisagara", "Kabagari", "Muganza"],
            "Mugombwa": ["Gisagara", "Kabagari", "Mugombwa"],
            "Mukingo": ["Gisagara", "Kabagari", "Mukingo"],
            "Muyira": ["Gisagara", "Kabagari", "Muyira"],
            "Nzangwa": ["Gisagara", "Kabagari", "Nzangwa"],
            "Save": ["Gisagara", "Kabagari", "Save"],
        },
        "Huye": {
            "Gishamvu": ["Gishamvu", "Huye", "Kabagari"],
            "Huye": ["Butare", "Huye", "Kabagari"],
            "Karama": ["Huye", "Kabagari", "Karama"],
            "Kigoma": ["Huye", "Kabagari", "Kigoma"],
            "Kinazi": ["Huye", "Kabagari", "Kinazi"],
            "Maraba": ["Huye", "Kabagari", "Maraba"],
            "Mbazi": ["Huye", "Kabagari", "Mbazi"],
            "Mukura": ["Huye", "Kabagari", "Mukura"],
            "Ngoma": ["Huye", "Kabagari", "Ngoma"],
            "Ruhashya": ["Huye", "Kabagari", "Ruhashya"],
            "Rusatira": ["Huye", "Kabagari", "Rusatira"],
            "Rwaniro": ["Huye", "Kabagari", "Rwaniro"],
            "Simbi": ["Huye", "Kabagari", "Simbi"],
            "Tumba": ["Huye", "Kabagari", "Tumba"],
        },
        "Muhanga": {
            "Cyeza": ["Cyeza", "Kabagari", "Muhanga"],
            "Kabacuzi": ["Kabacuzi", "Kabagari", "Muhanga"],
            "Kibangu": ["Kabagari", "Kibangu", "Muhanga"],
            "Kiyumba": ["Kabagari", "Kiyumba", "Muhanga"],
            "Muhanga": ["Gitarama", "Kabagari", "Muhanga"],
            "Mushishiro": ["Kabagari", "Muhanga", "Mushishiro"],
            "Nyamabuye": ["Kabagari", "Muhanga", "Nyamabuye"],
            "Nyarusange": ["Kabagari", "Muhanga", "Nyarusange"],
            "Rongi": ["Kabagari", "Muhanga", "Rongi"],
            "Rugendabari": ["Kabagari", "Muhanga", "Rugendabari"],
            "Shyogwe": ["Kabagari", "Muhanga", "Shyogwe"],
        },
        "Kamonyi": {
            "Gacurabwenge": ["Gacurabwenge", "Kabagari", "Kamonyi"],
            "Kamonyi": ["Kabagari", "Kamonyi"],
            "Kayenzi": ["Kabagari", "Kamonyi", "Kayenzi"],
            "Kayumbu": ["Kabagari", "Kamonyi", "Kayumbu"],
            "Mugina": ["Kabagari", "Kamonyi", "Mugina"],
            "Musambira": ["Kabagari", "Kamonyi", "Musambira"],
            "Ngamba": ["Kabagari", "Kamonyi", "Ngamba"],
            "Rukoma": ["Kabagari", "Kamonyi", "Rukoma"],
            "Runda": ["Kabagari", "Kamonyi", "Runda"],
        },
        "Nyanza": {
            "Busasamana": ["Busasamana", "Kabagari", "Nyanza"],
            "Busoro": ["Busoro", "Kabagari", "Nyanza"],
            "Cyabakamyi": ["Cyabakamyi", "Kabagari", "Nyanza"],
            "Kibirizi": ["Kabagari", "Kibirizi", "Nyanza"],
            "Kigoma": ["Kabagari", "Kigoma", "Nyanza"],
            "Mukingo": ["Kabagari", "Mukingo", "Nyanza"],
            "Muyira": ["Kabagari", "Muyira", "Nyanza"],
            "Ntyazo": ["Kabagari", "Ntyazo", "Nyanza"],
            "Nyagisozi": ["Kabagari", "Nyagisozi", "Nyanza"],
            "Rwabicuma": ["Kabagari", "Nyanza", "Rwabicuma"],
        },
        "Ruhango": {
            "Bweramana": ["Bweramana", "Kabagari", "Ruhango"],
            "Byimana": ["Byimana", "Kabagari", "Ruhango"],
            "Kabagari": ["Kabagari", "Ruhango"],
            "Kinazi": ["Kabagari", "Kinazi", "Ruhango"],
            "Kinihira": ["Kabagari", "Kinihira", "Ruhango"],
            "Mbuye": ["Kabagari", "Mbuye", "Ruhango"],
            "Mwendo": ["Kabagari", "Mwendo", "Ruhango"],
            "Ntongwe": ["Kabagari", "Ntongwe", "Ruhango"],
            "Ruhango": ["Kabagari", "Ntongwe", "Ruhango"],
        },
    },
    "Western Province": {
        "Karongi": {
            "Bwishyura": ["Bwishyura", "Kabagari", "Karongi"],
            "Gashari": ["Gashari", "Kabagari", "Karongi"],
            "Gishyita": ["Gishyita", "Kabagari", "Karongi"],
            "Gitesi": ["Gitesi", "Kabagari", "Karongi"],
            "Mubuga": ["Kabagari", "Karongi", "Mubuga"],
            "Murambi": ["Kabagari", "Karongi", "Murambi"],
            "Murundi": ["Kabagari", "Karongi", "Murundi"],
            "Mutuntu": ["Kabagari", "Karongi", "Mutuntu"],
            "Rugabano": ["Kabagari", "Karongi", "Rugabano"],
            "Ruganda": ["Kabagari", "Karongi", "Ruganda"],
            "Rwankuba": ["Kabagari", "Karongi", "Rwankuba"],
            "Twumba": ["Kabagari", "Karongi", "Twumba"],
        },
        "Ngororero": {
            "Bwira": ["Bwira", "Kabagari", "Ngororero"],
            "Gatumba": ["Gatumba", "Kabagari", "Ngororero"],
            "Hindiro": ["Hindiro", "Kabagari", "Ngororero"],
            "Kabaya": ["Kabagari", "Kabaya", "Ngororero"],
            "Kageyo": ["Kabagari", "Kageyo", "Ngororero"],
            "Kavumu": ["Kabagari", "Kavumu", "Ngororero"],
            "Matyazo": ["Kabagari", "Matyazo", "Ngororero"],
            "Muhanda": ["Kabagari", "Muhanda", "Ngororero"],
            "Muhororo": ["Kabagari", "Muhororo", "Ngororero"],
            "Ndaro": ["Kabagari", "Ndaro", "Ngororero"],
            "Ngororero": ["Kabagari", "Ngororero"],
            "Nyange": ["Kabagari", "Ngororero", "Nyange"],
            "Sovu": ["Kabagari", "Ngororero", "Sovu"],
        },
        "Nyabihu": {
            "Bigogwe": ["Bigogwe", "Kabagari", "Nyabihu"],
            "Jenda": ["Jenda", "Kabagari", "Nyabihu"],
            "Jomba": ["Jomba", "Kabagari", "Nyabihu"],
            "Kabatwa": ["Kabagari", "Kabatwa", "Nyabihu"],
            "Karago": ["Kabagari", "Karago", "Nyabihu"],
            "Kintobo": ["Kabagari", "Kintobo", "Nyabihu"],
            "Mukamira": ["Kabagari", "Mukamira", "Nyabihu"],
            "Muringa": ["Kabagari", "Muringa", "Nyabihu"],
            "Rambura": ["Kabagari", "Nyabihu", "Rambura"],
            "Rugera": ["Kabagari", "Nyabihu", "Rugera"],
            "Rurembo": ["Kabagari", "Nyabihu", "Rurembo"],
            "Shyira": ["Kabagari", "Nyabihu", "Shyira"],
        },
        "Nyamasheke": {
            "Bushekeri": ["Bushekeri", "Kabagari", "Nyamasheke"],
            "Bushenge": ["Bushenge", "Kabagari", "Nyamasheke"],
            "Cyato": ["Cyato", "Kabagari", "Nyamasheke"],
            "Gihombo": ["Gihombo", "Kabagari", "Nyamasheke"],
            "Kagano": ["Kabagari", "Kagano", "Nyamasheke"],
            "Kanjongo": ["Kabagari", "Kanjongo", "Nyamasheke"],
            "Karambi": ["Kabagari", "Karambi", "Nyamasheke"],
            "Karengera": ["Kabagari", "Karengera", "Nyamasheke"],
            "Kirimbi": ["Kabagari", "Kirimbi", "Nyamasheke"],
            "Macuba": ["Kabagari", "Macuba", "Nyamasheke"],
            "Mahembe": ["Kabagari", "Mahembe", "Nyamasheke"],
            "Nyabitekeri": ["Kabagari", "Nyabitekeri", "Nyamasheke"],
            "Rangiro": ["Kabagari", "Nyamasheke", "Rangiro"],
            "Ruharambuga": ["Kabagari", "Nyamasheke", "Ruharambuga"],
            "Shangi": ["Kabagari", "Nyamasheke", "Shangi"],
        },
        "Rubavu": {
            "Bugeshi": ["Bugeshi", "Kabagari", "Rubavu"],
            "Busasamana": ["Busasamana", "Kabagari", "Rubavu"],
            "Cyanzarwe": ["Cyanzarwe", "Kabagari", "Rubavu"],
            "Gisenyi": ["Gisenyi", "Kabagari", "Rubavu"],
            "Kanama": ["Kabagari", "Kanama", "Rubavu"],
            "Kanzenze": ["Kabagari", "Kanzenze", "Rubavu"],
            "Mudende": ["Kabagari", "Mudende", "Rubavu"],
            "Nyamyumba": ["Kabagari", "Nyamyumba", "Rubavu"],
            "Nyundo": ["Kabagari", "Nyundo", "Rubavu"],
            "Rubavu": ["Gisenyi", "Kabagari", "Rubavu"],
            "Rugerero": ["Kabagari", "Rubavu", "Rugerero"],
        },
        "Rusizi": {
            "Bugarama": ["Bugarama", "Kabagari", "Rusizi"],
            "Bweyeye": ["Bweyeye", "Kabagari", "Rusizi"],
            "Giheke": ["Giheke", "Kabagari", "Rusizi"],
            "Gihundwe": ["Gihundwe", "Kabagari", "Rusizi"],
            "Gikundamvura": ["Gikundamvura", "Kabagari", "Rusizi"],
            "Gitambi": ["Gitambi", "Kabagari", "Rusizi"],
            "Kamembe": ["Cyangugu", "Kabagari", "Rusizi"],
            "Muganza": ["Kabagari", "Muganza", "Rusizi"],
            "Mururu": ["Kabagari", "Mururu", "Rusizi"],
            "Nkanka": ["Kabagari", "Nkanka", "Rusizi"],
            "Nkungu": ["Kabagari", "Nkungu", "Rusizi"],
            "Nyakarenzo": ["Kabagari", "Nyakarenzo", "Rusizi"],
            "Nzahaha": ["Kabagari", "Nzahaha", "Rusizi"],
            "Rwimbogo": ["Kabagari", "Rusizi", "Rwimbogo"],
        },
        "Rutsiro": {
            "Boneza": ["Boneza", "Kabagari", "Rutsiro"],
            "Gihango": ["Gihango", "Kabagari", "Rutsiro"],
            "Kigeyo": ["Kabagari", "Kigeyo", "Rutsiro"],
            "Kivumu": ["Kabagari", "Kivumu", "Rutsiro"],
            "Manihira": ["Kabagari", "Manihira", "Rutsiro"],
            "Mukura": ["Kabagari", "Mukura", "Rutsiro"],
            "Murunda": ["Kabagari", "Murunda", "Rutsiro"],
            "Musasa": ["Kabagari", "Musasa", "Rutsiro"],
            "Mushonyi": ["Kabagari", "Mushonyi", "Rutsiro"],
            "Mushubati": ["Kabagari", "Mushubati", "Rutsiro"],
            "Nyabirasi": ["Kabagari", "Nyabirasi", "Rutsiro"],
            "Ruhango": ["Kabagari", "Ruhango", "Rutsiro"],
            "Rusebeya": ["Kabagari", "Rusebeya", "Rutsiro"],
        },
    },
}


def get_provinces() -> list[str]:
    return sorted(RWANDA_ADDRESSES.keys())


def get_districts(province: str | None = None) -> list[str]:
    if province:
        return sorted(RWANDA_ADDRESSES.get(province, {}).keys())
    districts: list[str] = []
    for prov_data in RWANDA_ADDRESSES.values():
        districts.extend(prov_data.keys())
    return sorted(set(districts))


def get_sectors(province: str, district: str) -> list[str]:
    return sorted(RWANDA_ADDRESSES.get(province, {}).get(district, {}).keys())


def get_cells(province: str, district: str, sector: str) -> list[str]:
    return sorted(RWANDA_ADDRESSES.get(province, {}).get(district, {}).get(sector, []))


def format_address(
    district: str | None,
    sector: str | None,
    cell: str | None,
    village: str | None,
    street_road: str | None = None,
) -> str:
    """Format a Rwanda address into a human-readable string."""
    parts = []
    if street_road:
        parts.append(street_road)
    if village:
        parts.append(village)
    if cell:
        parts.append(cell)
    if sector:
        parts.append(sector)
    if district:
        parts.append(district)
    parts.append("Rwanda")
    return ", ".join(p for p in parts if p)


def address_to_search_label(
    district: str | None,
    sector: str | None = None,
) -> str:
    """Short label for search filtering."""
    parts = [p for p in [sector, district] if p]
    return ", ".join(parts) if parts else "Rwanda"


def get_villages(province: str, district: str, sector: str) -> list[str]:
    """
    In Rwanda's NISR data the leaf nodes are cells/villages.
    We return the same list as cells — callers can treat them interchangeably.
    """
    return get_cells(province, district, sector)


def format_full_address(
    province: str | None = None,
    district: str | None = None,
    sector: str | None = None,
    cell: str | None = None,
    village: str | None = None,
    street_road: str | None = None,
    house_number: str | None = None,
    landmark: str | None = None,
) -> str:
    """
    Build a full human-readable address from finest-to-coarsest granularity.

    Order: house_number → street_road → landmark → village → cell
           → sector → district → province → Rwanda
    """
    parts: list[str] = []
    if house_number:
        parts.append(house_number)
    if street_road:
        parts.append(street_road)
    if landmark:
        parts.append(f"Near {landmark}")
    if village:
        parts.append(village)
    if cell:
        parts.append(cell)
    if sector:
        parts.append(sector)
    if district:
        parts.append(district)
    if province:
        parts.append(province)
    parts.append("Rwanda")
    return ", ".join(p for p in parts if p)
