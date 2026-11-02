# Lyra's body for the game: builds every part as a lofted mesh on the blockout's bones, exports assets/lyra/lyra.glb
# and renders previews from that exported file. The contract is in tools/blender/README.md.
#
#   blender -b --factory-startup --python tools/blender/lyra/build_lyra.py
#
# Blender space: z up, she faces -y, her left is +x. Parts are built in world space in the rest pose and moved into
# their bone's space on assembly. Parts are rigid per bone, so each one overlaps its neighbour at the joint.
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
BLOCKOUT = os.path.join(ROOT, "tools/blender/lyra_blockout.glb")
GLB = os.path.join(ROOT, "assets/lyra/lyra.glb")
PREVIEWS = os.path.join(HERE, "previews")
SHEET = os.environ.get("LYRA_SHEET")  # optional path for a contact sheet of the previews, for quick checks

BONES = {
    "base", "hips", "spine", "chest", "neck", "head", "hairBack", "earL", "earR", "armL", "foreArmL", "handL", "armR", "foreArmR", "handR",
    "skirt", "thighL", "shinL", "footL", "thighR", "shinR", "footR", "tail0", "tail1", "tail2", "prop",
}


def srgb(hexcolor):
    h = hexcolor.lstrip("#")
    c = np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


HAIR_DEEP = srgb("#241729")
HAIR_BASE = srgb("#35223F")
HAIR_SHEEN = srgb("#5A3D6E")
FUR_LILAC = srgb("#e3dbfa")
FUR_WHITE = srgb("#ffffff")
FUR_BLUSH = srgb("#ffe6f3")
ROBE_TOP = srgb("#F26BB6")
ROBE_MID = srgb("#C36EE6")
ROBE_HEM = srgb("#8559D6")
OBI_TOP = srgb("#B844AC")
OBI_LOW = srgb("#9A3BA8")
COLLAR_WHITE = srgb("#ffffff")
COLLAR_BLUSH = srgb("#FFE3F4")

# role: (colour, roughness, metallic, double sided, uses vertex colours)
ROLES = {
    "skin": ("#F8D6C0", 0.8, 0, False, False),
    "face": ("#F8D6C0", 0.8, 0, False, False),
    "hair": ("#ffffff", 0.48, 0, False, True),
    "hairDeep": ("#241729", 0.6, 0, True, False),
    "kimono": ("#a56ce8", 0.6, 0, False, True),
    "sleeve": ("#b47ef2", 0.6, 0, False, True),
    "lining": ("#FF6EB4", 0.6, 0, True, False),
    "rose": ("#FF6EB4", 0.55, 0, False, False),
    "roseSkirt": ("#f765b0", 0.55, 0, True, True),
    "underSkirt": ("#6A4AB3", 0.6, 0, True, False),
    "blush": ("#FFE3F4", 0.75, 0, False, True),
    "gold": ("#FFD45C", 0.3, 0.6, False, False),
    "amber": ("#E6A42A", 0.35, 0.5, False, False),
    "fur": ("#ffffff", 0.92, 0, False, True),
    "earInner": ("#ff9fcf", 0.8, 0, False, False),
    "lilac": ("#F2EEFF", 0.75, 0, False, False),
    "boot": ("#4A3226", 0.5, 0, False, False),
    "sole": ("#3a2920", 0.7, 0, False, False),
    "gem": ("#ff63b3", 0.2, 0.1, False, False),
    "dark": ("#2B2540", 0.6, 0, False, False),
    "emblem": ("#E4D9FF", 0.4, 0.2, False, False),
}


def make_material(role):
    color, rough, metal, double, vertex = ROLES[role]
    mat = bpy.data.materials.new(role)
    mat.use_nodes = True
    mat.use_backface_culling = not double
    nt = mat.node_tree
    p = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Base Color"].default_value = (*srgb(color), 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if vertex:
        node = nt.nodes.new("ShaderNodeVertexColor")
        node.layer_name = "Col"
        nt.links.new(node.outputs["Color"], p.inputs["Base Color"])
    if role == "gem":
        p.inputs["Emission Color"].default_value = (*srgb("#ff2f8f"), 1)
        p.inputs["Emission Strength"].default_value = 0.45
    return mat


# ---- shape helpers ----


def unit(v):
    v = np.asarray(v, dtype=float)
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)


def smooth(a, b, x):
    t = np.clip((np.asarray(x, dtype=float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    t = np.asarray(t, dtype=float)
    return a + (b - a) * t[..., None] if t.ndim else a + (b - a) * t


def robe(t):
    """The outer robe's gradient: pink-magenta at the top, through orchid, to purple at the hem."""
    t = np.asarray(t, dtype=float)
    return np.where((t < 0.5)[..., None], mix(ROBE_TOP, ROBE_MID, np.clip(t * 2, 0, 1)), mix(ROBE_MID, ROBE_HEM, np.clip(t * 2 - 1, 0, 1)))


def spow(x, e):
    return np.sign(x) * np.abs(x) ** e


def spline(points, rows, spacing=None):
    """Catmull-Rom through the points, resampled by length into rows + 1 samples: evenly, or at the given 0 to 1 spacing."""
    p = np.asarray(points, dtype=float)
    q = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    seg = len(p) - 1
    t = np.linspace(0, seg, max(rows * 8, 32) + 1)
    i = np.minimum(t.astype(int), seg - 1)
    f = (t - i)[:, None]
    a, b, c, d = q[i], q[i + 1], q[i + 2], q[i + 3]
    dense = 0.5 * (2 * b + (c - a) * f + (2 * a - 5 * b + 4 * c - d) * f**2 + (3 * b - a - 3 * c + d) * f**3)
    length = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(dense, axis=0), axis=1))])
    want = np.linspace(0, length[-1], rows + 1) if spacing is None else np.asarray(spacing) * length[-1]
    return np.stack([np.interp(want, length, dense[:, k]) for k in range(3)], axis=1)


def frames(path, normal):
    """(side, up) along a path. normal is one vector, one per point, or a function of the points."""
    t = unit(np.gradient(path, axis=0))
    n = normal(path) if callable(normal) else np.broadcast_to(np.asarray(normal, dtype=float), path.shape)
    s = np.cross(t, n)
    bad = np.linalg.norm(s, axis=1) < 1e-5
    if bad.any():
        s[bad] = np.cross(t[bad], [0.13, 0.31, 0.94])
    s = unit(s)
    return s, unit(np.cross(s, t))


def carried_frames(path, normal):
    """(side, up) carried along a path from its first frame, so a ribbon that curls does not flip over."""
    t = unit(np.gradient(path, axis=0))
    s0, _ = frames(path[:2], normal)
    s = np.zeros_like(path)
    s[0] = s0[0]
    for i in range(1, len(path)):
        s[i] = unit(s[i - 1] - (s[i - 1] @ t[i]) * t[i])
    return s, unit(np.cross(s, t))


def grid_faces(rows, cols, closed=True):
    ids = np.arange(rows * cols).reshape(rows, cols)
    out = []
    for i in range(rows - 1):
        for j in range(cols if closed else cols - 1):
            k = (j + 1) % cols
            out.append((ids[i, j], ids[i, k], ids[i + 1, k], ids[i + 1, j]))
    return out


def capped(grid, cap_start=True, cap_end=True):
    """Vertices and faces of a closed grid of rings (r, c, 3), with n-gon caps."""
    r, c = grid.shape[:2]
    faces = grid_faces(r, c)
    ids = np.arange(r * c).reshape(r, c)
    if cap_start:
        faces.append(tuple(ids[0][::-1]))
    if cap_end:
        faces.append(tuple(ids[-1]))
    return grid.reshape(-1, 3), faces


def polar(fn, rows, cols):
    """A closed surface from fn(v, u) with v from 0 (top pole) to pi (bottom pole)."""
    v = np.linspace(0, math.pi, rows + 1)
    u = np.linspace(0, 2 * math.pi, cols, endpoint=False)
    vv, uu = np.meshgrid(v[1:-1], u, indexing="ij")
    rings = fn(vv, uu)
    top = fn(np.array([[0.0]]), np.array([[0.0]]))[0, 0]
    bottom = fn(np.array([[math.pi]]), np.array([[0.0]]))[0, 0]
    verts = np.vstack([rings.reshape(-1, 3), top, bottom])
    n = rings.shape[0] * cols
    ids = np.arange(n).reshape(rings.shape[0], cols)
    faces = grid_faces(rings.shape[0], cols)
    for j in range(cols):
        k = (j + 1) % cols
        faces.append((n, ids[0, k], ids[0, j]))
        faces.append((n + 1, ids[-1, j], ids[-1, k]))
    return verts, faces


def ellipsoid(center, radii, rot=None, rows=6, cols=8):
    rot = np.eye(3) if rot is None else np.asarray(rot)
    radii = np.asarray(radii, dtype=float)

    def fn(v, u):
        p = np.stack([np.sin(v) * np.cos(u), np.sin(v) * np.sin(u), np.cos(v)], axis=-1) * radii
        return p @ rot.T + np.asarray(center)

    return polar(fn, rows, cols)


def basis(forward, up=(0, 0, 1)):
    """Columns x, y, z with z along forward and y as near to up as it can be."""
    z = unit(forward)
    x = np.cross(up, z)
    if np.linalg.norm(x) < 1e-5:
        x = np.cross((0, 1, 0), z)
    x = unit(x)
    return np.stack([x, np.cross(z, x), z], axis=1)


class Body:
    """Collects parts per bone and role, then makes one mesh per bone."""

    def __init__(self):
        self.parts = {}

    def add(self, bone, role, verts, faces, colors=None, shade=True, ref=None):
        """World-space part. Closed parts wind outward by their volume; for an open shell, ref is a point inside it."""
        verts = np.asarray(verts, dtype=float)
        used = np.unique(np.fromiter((i for f in faces for i in f), dtype=np.int64))
        remap = -np.ones(len(verts), dtype=np.int64)
        remap[used] = np.arange(len(used))
        faces = [tuple(int(remap[i]) for i in f) for f in faces]
        verts = verts[used]
        if colors is not None:
            colors = np.asarray(colors, dtype=float)[used]
        score = 0.0
        center = verts.mean(axis=0) if ref is None else np.asarray(ref, dtype=float)
        for f in faces:
            a = verts[f[0]] - center
            for j in range(1, len(f) - 1):
                b, c = verts[f[j]] - center, verts[f[j + 1]] - center
                score += float(a @ np.cross(b, c))
        if score < 0:
            faces = [f[::-1] for f in faces]
        self.parts.setdefault(bone, []).append((role, verts, faces, colors, shade))

    def assemble(self, materials):
        tris = {}
        for bone, parts in self.parts.items():
            empty = bpy.data.objects[bone]
            to_local = np.array(empty.matrix_world.inverted())
            verts, faces, colors, flags, slots, slot_of = [], [], [], [], [], []
            offset = 0
            for role, v, f, c, shade in parts:
                if role not in slot_of:
                    slot_of.append(role)
                verts.append(v @ to_local[:3, :3].T + to_local[:3, 3])
                colors.append(np.tile(srgb(ROLES[role][0]), (len(v), 1)) if c is None else c)
                faces.extend(tuple(i + offset for i in face) for face in f)
                slots.extend([slot_of.index(role)] * len(f))
                flags.extend([shade] * len(f))
                offset += len(v)
            mesh = bpy.data.meshes.new(f"{bone}.body")
            mesh.from_pydata(np.concatenate(verts).tolist(), [], faces)
            for role in slot_of:
                mesh.materials.append(materials[role])
            mesh.polygons.foreach_set("material_index", slots)
            mesh.polygons.foreach_set("use_smooth", flags)
            attr = mesh.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
            rgba = np.concatenate([np.concatenate(colors), np.ones((offset, 1))], axis=1)
            attr.data.foreach_set("color", rgba.astype(np.float32).ravel())
            mesh.update()
            obj = bpy.data.objects.new(mesh.name, mesh)
            bpy.context.scene.collection.objects.link(obj)
            obj.parent = empty
            obj.matrix_parent_inverse = Matrix.Identity(4)
            mesh.calc_loop_triangles()
            tris[bone] = len(mesh.loop_triangles)
        return tris


def tube(body, bone, role, path, radius, sides=6, closed=False, flat=None, normal=(0, 0, 1), cap=True, step=1):
    """A round or flattened tube along a path; trims, cords and piping. flat scales it along the normal."""
    path = np.asarray(path, dtype=float)[:: step]
    r = np.broadcast_to(radius, (len(path),))[:, None, None]
    if closed:
        t = unit(np.roll(path, -1, axis=0) - np.roll(path, 1, axis=0))
        n = normal(path) if callable(normal) else np.broadcast_to(np.asarray(normal, dtype=float), path.shape)
        s = unit(np.cross(t, n))
        u = unit(np.cross(s, t))
    else:
        s, u = frames(path, normal)
    a = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    k = 1.0 if flat is None else flat
    ring = np.cos(a)[None, :, None] * s[:, None, :] + k * np.sin(a)[None, :, None] * u[:, None, :]
    grid = path[:, None, :] + ring * r
    if closed:
        grid = np.concatenate([grid, grid[:1]], axis=0)
        faces = grid_faces(len(grid), sides)
        body.add(bone, role, grid.reshape(-1, 3), faces)
    else:
        body.add(bone, role, *capped(grid, cap, cap))


def lock(body, bone, pts, half_width, thick=0.5, rows=10, sides=7, normal=(0, 1, 0), start=0.45, tip=2.2, lens=1.0, palette=None, role="hair", carry=False, soft_end=True):
    """One soft clump of hair, like a piece of sculpted clay: swelling from the root and tapering to a rounded end. Dark on
    its underside with a quiet highlight along its top. palette(t) replaces that colouring. soft_end=False ends in a point."""
    # A soft end needs its rows packed towards the tip, to round off instead of stopping short.
    t = 1 - (1 - np.linspace(0, 1, rows + 1)) ** (1.8 if soft_end else 1.0)
    path = spline(pts, rows, t)
    s, u = (carried_frames if carry else frames)(path, normal)
    w = half_width * (start + (1 - start) * smooth(0.0, 0.24, t)) * (1 - t**tip) ** (0.55 if soft_end else 0.85) + 0.0012
    h = w * (thick + (0.85 - thick) * smooth(0.6, 0.9, t) if soft_end else thick) + 0.0006
    a = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    ca, sa = np.cos(a), np.sin(a)
    across = ca[None, :, None] * s[:, None, :] * w[:, None, None]
    out = spow(sa, lens)[None, :, None] * u[:, None, :] * h[:, None, None]
    grid = path[:, None, :] + across + out
    if palette is not None:
        c = np.repeat(palette(t)[:, None, :], sides, axis=1)
    else:
        top = smooth(-0.9, 0.3, sa)[None, :]
        c = mix(HAIR_DEEP, HAIR_BASE, np.broadcast_to(top, (rows + 1, sides)))
        ridge = np.exp(-(((ca[None, :] - 0.15) / 0.7) ** 2)) * smooth(-0.2, 0.6, sa)[None, :] * np.exp(-(((t[:, None] - 0.42) / 0.34) ** 2))
        c = mix(c, HAIR_SHEEN, ridge * 0.7)
    verts, faces = capped(grid)
    body.add(bone, role, verts, faces, colors=c.reshape(-1, 3))


# ---- head shape, in head-bone space: x her left, y back, z up from the head bone ----

HEAD_CZ = 0.205
HEAD_RZ = 0.205
HEAD_E = 2.25


def head_radii(z):
    t = np.clip((HEAD_CZ - np.asarray(z, dtype=float)) / HEAD_RZ, 0, 1)
    rx = 0.218 * (1 - 0.2 * smooth(0.25, 1.0, t))
    ry = 0.192 * (1 - 0.14 * smooth(0.25, 1.0, t))
    return rx, ry


def head_point(v, u, lift=0.0):
    """A point on the head surface, pushed out along the radial direction by lift."""
    cv, sv = np.cos(v), np.sin(v)
    z = HEAD_CZ + HEAD_RZ * spow(cv, 2 / HEAD_E)
    rho = spow(sv, 2 / HEAD_E)
    rx, ry = head_radii(z)
    x = rx * rho * spow(np.cos(u), 2 / HEAD_E)
    y = ry * rho * spow(np.sin(u), 2 / HEAD_E)
    p = np.stack([x, y, z], axis=-1)
    if np.ndim(lift) or lift:
        d = unit(p - np.array([0, 0, HEAD_CZ]))
        p = p + d * np.asarray(lift)[..., None] if np.ndim(lift) else p + d * lift
    return p


def surface_y(x, z, lift=0.0, side=-1):
    """y on the head surface (side -1 is the front) at a given x and z, lifted off it."""
    rx, ry = head_radii(z)
    rest = 1 - np.abs(np.asarray(x) / (rx + lift)) ** HEAD_E - np.abs((np.asarray(z) - HEAD_CZ) / (HEAD_RZ + lift)) ** HEAD_E
    return side * (ry + lift) * np.clip(rest, 0, 1) ** (1 / HEAD_E)


def hairline(x):
    """Height of the hairline on the front of the head."""
    return 0.375 - 0.18 * smooth(0.0, 0.2, np.abs(x))


def build_head(body, B):
    o = B["head"][0]

    def fn(v, u):
        return head_point(v, u) + o

    verts, faces = polar(fn, 22, 34)
    local = verts - o
    keep, front = [], []
    for f in faces:
        c = local[list(f)].mean(axis=0)
        hidden = c[2] > hairline(c[0]) + 0.03 or (c[1] > 0.02 and c[2] > 0.08)
        if hidden:
            continue
        (front if c[1] < -0.02 else keep).append(f)
    body.add("head", "face", verts, front, ref=o + [0, 0, HEAD_CZ])
    body.add("head", "skin", verts, keep, ref=o + [0, 0, HEAD_CZ])
    # Neck: reaches up inside the head and down inside the collar.
    z = np.linspace(0.54, 0.635, 4)
    r = np.array([0.05, 0.047, 0.046, 0.05])
    a = np.linspace(0, 2 * math.pi, 14, endpoint=False)
    grid = np.stack([np.outer(r, np.cos(a)), np.outer(r, np.sin(a)) * 0.95 + 0.004, np.repeat(z[:, None], 14, axis=1)], axis=-1)
    body.add("neck", "skin", *capped(grid))


def build_cap(body, B):
    """The hair over the skull. Around the face it dives under the skin, which draws a clean hairline with no cut edge."""
    o = B["head"][0]

    def lift_at(p):
        x, y, z = p[..., 0], p[..., 1], p[..., 2]
        above = (z - hairline(x)) / 0.035
        beside = (np.abs(x) - (0.2 - 0.02 * smooth(0.25, 0.1, z))) / 0.03
        outside = np.clip(np.maximum(above, beside), -1, 1)
        behind = smooth(-0.075, -0.02, y)
        f = np.maximum(smooth(-1, 1, outside), behind)
        lift = -0.03 + (0.052 + 0.012 * smooth(0.2, 0.38, z)) * f
        # The parting: a shallow valley down the middle of the crown towards the forehead.
        lift = lift - 0.012 * np.exp(-((x / 0.022) ** 2)) * smooth(0.06, -0.06, y) * smooth(0.25, 0.36, z)
        return lift

    def fn(v, u):
        p = head_point(v, u)
        return head_point(v, u, lift_at(p)) + o

    verts, faces = polar(fn, 22, 36)
    local = verts - o
    v0 = head_point(*_param_grid(22, 36))
    lifts = lift_at(v0)
    keep = [f for f in faces if lifts[list(f)].max() > -0.004]
    colors = mix(HAIR_DEEP, HAIR_BASE, 0.7 + 0.3 * smooth(0.15, 0.36, local[:, 2]))
    body.add("head", "hair", verts, keep, colors=colors, ref=o + [0, 0, HEAD_CZ])


def _param_grid(rows, cols):
    """The (v, u) of polar()'s vertices, flattened, with its two poles last."""
    v = np.linspace(0, math.pi, rows + 1)
    u = np.linspace(0, 2 * math.pi, cols, endpoint=False)
    vv, uu = np.meshgrid(v[1:-1], u, indexing="ij")
    return np.concatenate([vv.ravel(), [0.0, math.pi]]), np.concatenate([uu.ravel(), [0.0, 0.0]])


def head_normal(o):
    return lambda p: unit(p - (o + [0, 0, HEAD_CZ]))


def on_front(o, xz, lift):
    """Turns (x, z) control points on the front of the head into world points lifted off it."""
    out = []
    for i, (x, z) in enumerate(xz):
        li = lift[i] if np.ndim(lift) else lift
        out.append(o + np.array([x, float(surface_y(x, z, li)), z]))
    return out


def build_fringe(body, B):
    """Soft curtain bangs from a middle parting, sweeping to both sides so the centre of the forehead shows skin. Over the
    eyes their lower edge stays at or above 0.21 m, as the painted face needs."""
    o = B["head"][0]
    n = head_normal(o)
    # (x, z) control points on the front of the head, half width, centre-line lift off the skin
    fan = [
        (((0.035, 0.4), (0.095, 0.372), (0.155, 0.318), (0.2, 0.25), (0.222, 0.185)), 0.07, 0.024),
        (((0.02, 0.405), (0.075, 0.386), (0.13, 0.346), (0.175, 0.296), (0.2, 0.25)), 0.064, 0.03),
        (((0.01, 0.392), (0.045, 0.366), (0.095, 0.325), (0.14, 0.28), (0.168, 0.235)), 0.056, 0.02),
    ]
    for sx in (-1, 1):
        for xz, w, lift in fan:
            pts = on_front(o, [(sx * x, z) for x, z in xz], [lift, lift, lift * 0.9, lift * 0.75, lift * 0.55])
            lock(body, "head", pts, w, thick=0.32, rows=10, sides=8, normal=n, start=0.55, tip=2.4)


def build_crown(body, B):
    """A few broad, low clumps from the parting over the top and sides of the skull, so the cap reads as sculpted hair."""
    o = B["head"][0]
    n = head_normal(o)
    center = np.array([0, 0, HEAD_CZ])
    for sx in (-1, 1):
        for i, az in enumerate((18, 62)):
            a = math.radians(az)
            way = np.array([sx * math.cos(a), math.sin(a)])
            root_y = -0.04 + 0.05 * i
            pts = [np.array([sx * 0.012, root_y, 0.405])]
            for t, z in ((0.09, 0.402), (0.17, 0.355), (0.215, 0.285), (0.235, 0.21)):
                q = np.array([way[0] * t, root_y + way[1] * t * 0.9, z])
                rx, ry = head_radii(z)
                k = (np.abs(q[0] / (rx + 0.04)) ** HEAD_E + np.abs(q[1] / (ry + 0.04)) ** HEAD_E + np.abs((z - HEAD_CZ) / (HEAD_RZ + 0.04)) ** HEAD_E) ** (1 / HEAD_E)
                pts.append(center + (q - center) / k)
            lock(body, "head", np.array(pts) + o, 0.105, thick=0.26, rows=7, sides=7, normal=n, start=0.5, tip=3.0)


def build_side_locks(body, B):
    """The side volume at the cheeks: two soft clumps a side from the temple past the jaw, turning in at the ends."""
    o = B["head"][0]
    n = lambda p: unit(p - (o + [0, 0.02, HEAD_CZ]))
    for sx in (-1, 1):
        rear = [(0.215, -0.03, 0.335), (0.268, -0.04, 0.235), (0.288, -0.045, 0.115), (0.288, -0.05, -0.01), (0.268, -0.075, -0.11), (0.238, -0.1, -0.15)]
        front = [(0.19, -0.1, 0.335), (0.236, -0.115, 0.25), (0.248, -0.115, 0.16), (0.24, -0.115, 0.06), (0.216, -0.125, -0.02), (0.19, -0.14, -0.06)]
        for pts, w in ((rear, 0.09), (front, 0.074)):
            lock(body, "head", np.array(pts) * [sx, 1, 1] + o, w, thick=0.44, rows=12, sides=8, normal=n, start=0.6, tip=2.1)


def build_strands(body, B):
    """One small soft tuft at the parting, which is all the hair needs to break its outline."""
    o = B["head"][0]
    lock(body, "head", np.array([(0.004, -0.01, 0.42), (0.018, -0.02, 0.452), (0.05, -0.014, 0.474), (0.086, 0.004, 0.468)]) + o, 0.02, thick=0.7, rows=6, sides=6, normal=(0, -1, 0), start=0.8, tip=2.0)


def back_path(az, z_end, r_end, wave, phase, curl, curl_r=0.09):
    """Control points of one back clump, world space. az is around the back: 0 straight behind, + towards her left.
    The waves share one phase along the height, so neighbouring clumps flow together."""
    az0 = math.radians(az)
    pts = []
    heights = [z for z in (0.97, 0.9, 0.81, 0.72, 0.63, 0.54, 0.46, 0.38) if z > z_end + 0.04] + [z_end]
    for z in heights:
        r = float(np.interp(z, [0.3, 0.42, 0.55, 0.72, 0.81, 0.9, 0.97], [r_end, 0.262, 0.256, 0.25, 0.24, 0.205, 0.1]))
        fall = float(smooth(0.72, 0.52, z))
        a = az0 * (1 - 0.3 * fall) if abs(az) > 60 else az0
        depth = 0.86 + 0.2 * fall
        y0 = 0.03 + 0.02 * fall
        reach = wave * float(smooth(0.82, 0.58, z))
        rad = np.array([math.sin(a), math.cos(a) * depth])
        tan = np.array([math.cos(a), -math.sin(a) * depth])
        xy = rad * (r + 0.3 * reach * math.cos(z * 18.0 + phase)) + tan * reach * math.sin(z * 18.0 + phase)
        y = y0 + xy[1]
        # Below the jaw, the clumps at her sides stay behind the shoulders.
        if abs(az) > 60:
            y = max(y, 0.07 * fall + y * (1 - fall))
        pts.append((xy[0], y, z))
    end = np.array(pts[-1])
    radial = unit(np.array([end[0], end[1] - 0.05, 0.0]))
    side = np.array([radial[1], -radial[0], 0.0]) * curl
    hook = unit(side + radial * 0.35)
    for deg, k in ((30, 1.0), (60, 1.0), (90, 1.0), (118, 0.96), (142, 0.9)):
        th = math.radians(deg)
        pts.append(tuple(end + (hook * (1 - math.cos(th)) + np.array([0, 0, -1.0]) * math.sin(th)) * curl_r * k))
    return np.array(pts)


def build_back_hair(body, B):
    """The back hair on its own bone: one big soft mass down to the hips, made of a few broad wavy clumps with round curled ends."""
    hb = "hairBack"
    # A dark filler behind the clumps, open at the front, behind the torso and sleeves.
    rows, cols = 8, 24
    z = np.linspace(0.96, 0.36, rows)
    a = np.linspace(-1.95, 1.95, cols)
    zz, aa = np.meshgrid(z, a, indexing="ij")
    fall = smooth(0.72, 0.52, zz)
    r = np.interp(zz, [0.36, 0.45, 0.6, 0.8, 0.96], [0.225, 0.235, 0.225, 0.215, 0.12])
    x = r * np.sin(aa * (1 - 0.3 * fall))
    y = 0.03 + 0.02 * fall + r * np.cos(aa * (1 - 0.3 * fall)) * (0.82 + 0.2 * fall)
    y = np.where(fall > 0, np.maximum(y, 0.05 * fall + y * (1 - fall)), y)
    grid = np.stack([x, y, zz], axis=-1)
    body.add(hb, "hairDeep", grid.reshape(-1, 3), grid_faces(rows, cols, closed=False), ref=(0, 0.02, 0.6))
    center = np.array([0, 0.04, 0.0])

    def radial(p):
        d = p - center
        d[:, 2] = 0.15 * (p[:, 2] - 0.8)
        return unit(d)

    # Outer clumps first, so nearer ones sit on top. (az, end height, end radius, curl direction, half width)
    clumps = [
        (-112, 0.42, 0.262, 1, 0.108),
        (112, 0.42, 0.262, -1, 0.108),
        (-74, 0.37, 0.268, 1, 0.132),
        (74, 0.36, 0.268, -1, 0.132),
        (-37, 0.36, 0.258, -1, 0.14),
        (37, 0.35, 0.258, 1, 0.14),
        (0, 0.345, 0.252, 1, 0.142),
    ]
    for az, z_end, r_end, curl, w in clumps:
        pts = back_path(az, z_end, r_end, 0.03, phase=0.5 + az * 0.005, curl=curl)
        lock(body, hb, pts, w, thick=0.4, rows=18, sides=9, normal=radial, start=0.22, tip=3.4, carry=True)


def build_ears(body, B):
    """Large soft fox ears: broad rounded triangles, thick and a little dished in front, white with a faint lilac base,
    a big pink inner ear and a white tuft of fluff at its base."""
    for bone, sx in (("earL", 1), ("earR", -1)):
        o, R = B[bone]

        def world(p):
            return p @ R.T + o

        rows, cols = 13, 16
        t = np.linspace(0, 1, rows)
        z = -0.035 + 0.27 * t
        w = 0.066 * (1 - t**1.9) ** 0.72 + 0.002
        d = 0.042 * (1 - t**2.2) ** 0.6 + 0.002
        sweep = sx * 0.03 * smooth(0.0, 1.0, t)
        a = np.linspace(0, 2 * math.pi, cols, endpoint=False)
        ca, sa = np.cos(a), np.sin(a)
        back = np.where(sa > 0, sa, sa * 0.42)  # +y is behind; the front is shallower
        grid = np.stack([np.outer(w, ca) + sweep[:, None], np.outer(d, back), np.repeat(z[:, None], cols, axis=1)], axis=-1)
        colors = np.repeat(mix(FUR_LILAC, FUR_WHITE, smooth(0.0, 0.55, t))[:, None, :], cols, axis=1)
        verts, faces = capped(world(grid))
        body.add(bone, "fur", verts, faces, colors=colors.reshape(-1, 3))
        # The pink inner ear, lying on the front of the ear.
        rows2, cols2 = 9, 12
        t2 = np.linspace(0, 1, rows2)
        h2 = 0.005 + 0.185 * t2
        along = (h2 + 0.035) / 0.27
        w2 = 0.052 * (1 - t2**2.0) ** 0.7 + 0.0015
        front = (0.042 * (1 - along**2.2) ** 0.6 + 0.002) * 0.42
        a2 = np.linspace(0, 2 * math.pi, cols2, endpoint=False)
        inner = np.stack(
            [
                np.outer(w2, np.cos(a2)) + (sx * 0.03 * smooth(0.0, 1.0, along))[:, None],
                np.outer(0.0045 * (1 - t2**2) + 0.0008, np.sin(a2)) - front[:, None] - 0.001,
                np.repeat(h2[:, None], cols2, axis=1),
            ],
            axis=-1,
        )
        body.add(bone, "earInner", *capped(world(inner)))
        # A soft tuft of fluff at the inner base.
        for center, radii in (((0.0, -0.028, 0.035), (0.03, 0.016, 0.034)), ((-0.026, -0.025, 0.024), (0.02, 0.014, 0.024)), ((0.027, -0.025, 0.026), (0.02, 0.014, 0.025))):
            v, f = ellipsoid(center, radii, rows=5, cols=8)
            body.add(bone, "fur", world(v), f, colors=np.tile(FUR_WHITE, (len(v), 1)))


def flower(body, bone, center, normal, size, petal="rose", middle="gold"):
    """A soft five-petal flower as one smooth piece, scalloped around its edge, with a round centre."""
    R = basis(normal)

    def fn(v, u):
        lobe = 0.62 + 0.38 * np.abs(np.cos(2.5 * u)) ** 0.7
        rho = np.sin(v) ** 0.75 * lobe * size * 1.5
        p = np.stack([rho * np.cos(u), rho * np.sin(u), np.cos(v) * size * 0.42], axis=-1)
        return p @ R.T + np.asarray(center)

    body.add(bone, petal, *polar(fn, 5, 20))
    body.add(bone, middle, *ellipsoid(np.asarray(center) + R @ np.array([0, 0, size * 0.34]), (size * 0.48, size * 0.48, size * 0.34), R, 4, 8))


def bell(body, bone, top, size):
    """A round little temple bell hanging from a point, with a loop above it."""
    profile = [(0.3, 1.05), (0.62, 0.86), (0.82, 0.4), (0.92, -0.1), (1.04, -0.5), (1.12, -0.72), (1.0, -0.84)]
    p = np.asarray(top, dtype=float) + [0, 0, -1.32 * size]
    a = np.linspace(0, 2 * math.pi, 12, endpoint=False)
    rs = np.array([q[0] for q in profile]) * size
    zs = np.array([q[1] for q in profile]) * size
    grid = np.stack([np.outer(rs, np.cos(a)) + p[0], np.outer(rs, np.sin(a)) + p[1], zs[:, None] * np.ones_like(a) + p[2]], axis=-1)
    body.add(bone, "gold", *capped(grid))
    body.add(bone, "dark", *ellipsoid(p + [0, 0, -0.9 * size], (0.3 * size,) * 3, rows=4, cols=6))
    turn = np.linspace(0, 2 * math.pi, 8, endpoint=False)
    circle = np.stack([np.zeros(8), 0.3 * size * np.cos(turn), 0.3 * size * np.sin(turn)], axis=1) + p + [0, 0, 1.28 * size]
    tube(body, bone, "gold", circle, 0.1 * size, sides=4, closed=True, normal=(1, 0, 0))


def gem(body, bone, center, radii, rot=None):
    """A faceted gem with flat facets."""
    rot = np.eye(3) if rot is None else rot
    k = np.array([(1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1), (0, -1, 0), (0, 1, 0)], dtype=float) * radii
    faces = [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]
    body.add(bone, "gem", k @ rot.T + center, faces, shade=False)


def build_ornaments(body, B):
    o = B["head"][0]
    # A small gold chevron on the bare forehead, with a pink gem at its heart. Its arms tuck under the bangs.
    for sx in (-1, 1):
        arm = [(0.0, 0.3), (sx * 0.024, 0.318), (sx * 0.048, 0.34), (sx * 0.068, 0.36)]
        pts = np.array([(x, float(surface_y(x, z, 0.006)), z) for x, z in arm]) + o
        path = spline(pts, 6)
        tube(body, "head", "gold", path, np.linspace(0.0105, 0.0065, len(path)), sides=6, flat=0.55, normal=head_normal(o))
    gz = 0.322
    gy = float(surface_y(0.0, gz, 0.012))
    gem(body, "head", o + np.array([0, gy, gz]), np.array((0.0135, 0.008, 0.021)))

    # At each temple: a cluster of pink flowers with gold centres, and two big gold bells hanging below it.
    for sx in (-1, 1):
        out = (sx * 0.74, -0.64, 0.2)
        flower(body, "head", o + np.array([sx * 0.262, -0.125, 0.292]), out, 0.031)
        flower(body, "head", o + np.array([sx * 0.25, -0.092, 0.352]), (sx * 0.72, -0.5, 0.48), 0.024)
        flower(body, "head", o + np.array([sx * 0.292, -0.062, 0.298]), (sx * 0.94, -0.3, 0.16), 0.024)
        for at, drop, size in (((0.276, -0.135, 0.255), 0.022, 0.034), ((0.3, -0.075, 0.262), 0.018, 0.03)):
            start = o + np.array([sx * at[0], at[1], at[2]])
            end = start + [0, 0, -drop]
            tube(body, "head", "rose", np.array([start, (start + end) / 2, end]), 0.0034, sides=4, normal=(0, -1, 0))
            bell(body, "head", end, size)


# ---- torso, in world space ----

TORSO_E = 2.4
TORSO_Z = np.array([0.32, 0.39, 0.45, 0.5, 0.54, 0.565, 0.59])
TORSO_RX = np.array([0.118, 0.12, 0.124, 0.127, 0.114, 0.086, 0.05])
TORSO_RY = np.array([0.098, 0.098, 0.097, 0.092, 0.08, 0.066, 0.046])


def torso_radii(z):
    return np.interp(z, TORSO_Z, TORSO_RX), np.interp(z, TORSO_Z, TORSO_RY)


def torso_y(x, z, lift=0.0):
    rx, ry = torso_radii(z)
    rest = np.clip(1 - np.abs(x / (rx + lift)) ** TORSO_E, 0, 1)
    return -(ry + lift) * rest ** (1 / TORSO_E)


def ring_grid(zs, rx, ry, cols, e=2.4, y0=0.0):
    a = np.linspace(0, 2 * math.pi, cols, endpoint=False)
    cx, sy = spow(np.cos(a), 2 / e), spow(np.sin(a), 2 / e)
    return np.stack([np.outer(rx, cx), np.outer(ry, sy) + y0, np.repeat(np.asarray(zs)[:, None], cols, axis=1)], axis=-1)


def build_torso(body):
    zs = np.array([0.32, 0.39, 0.45, 0.5, 0.54, 0.565, 0.59])
    grid = ring_grid(zs, *torso_radii(zs), 22)
    colors = np.repeat(robe(np.interp(zs, [0.39, 0.56], [0.42, 0.0]))[:, None, :], 22, axis=1)
    verts, faces = capped(grid)
    body.add("chest", "kimono", verts, faces, colors=colors.reshape(-1, 3))

    # The inner collar showing in the V, white at the neck and blush lower down.
    rows, cols = 9, 7
    z = np.linspace(0.385, 0.572, rows)
    hw = np.interp(z, [0.385, 0.56, 0.572], [0.024, 0.07, 0.066])
    grid = np.zeros((rows, cols, 3))
    for i in range(rows):
        xs = np.linspace(-hw[i], hw[i], cols)
        grid[i, :, 0] = xs
        grid[i, :, 1] = torso_y(xs, z[i], 0.006)
        grid[i, :, 2] = z[i]
    colors = np.repeat(mix(COLLAR_BLUSH, COLLAR_WHITE, smooth(0.4, 0.55, z))[:, None, :], cols, axis=1)
    body.add("chest", "blush", grid.reshape(-1, 3), grid_faces(rows, cols, closed=False), colors=colors.reshape(-1, 3), ref=(0, 0, 0.47))

    # Overlapping V collar, her left side over her right, each lapel running round the back of the neck.
    for sx, lift in ((-1, 0.0035), (1, 0.0085)):
        down = [(0.074, 0.555), (0.052, 0.5), (0.02, 0.44), (-0.022, 0.385), (-0.05, 0.36)]
        front = [np.array([sx * x, float(torso_y(sx * x, z, lift + 0.003)), z]) for x, z in down]
        round_back = [np.array(p, dtype=float) for p in ((0.0, 0.066, 0.598), (sx * 0.05, 0.046, 0.596), (sx * 0.074, 0.0, 0.59), (sx * 0.08, -0.038, 0.578))]
        path = spline(round_back + front, 17)
        outward = lambda p: unit(np.stack([p[:, 0] * 0.8, p[:, 1], 0.45 * np.ones(len(p))], axis=1))
        s, u = frames(path, outward)
        # s points to one side of the path; make it point out of the V.
        at = len(path) * 2 // 3
        if s[at, 0] * sx < 0:
            s = -s
        a = np.linspace(0, 2 * math.pi, 6, endpoint=False)
        width = 0.017
        grid = path[:, None, :] + np.cos(a)[None, :, None] * s[:, None, :] * width + np.sin(a)[None, :, None] * u[:, None, :] * 0.0062
        body.add("chest", "rose", *capped(grid))
        # White band towards the V, and gold piping along the outer edge.
        inner = path - s * (width + 0.0095) - u * 0.001
        grid = inner[:, None, :] + np.cos(a)[None, :, None] * s[:, None, :] * 0.0115 + np.sin(a)[None, :, None] * u[:, None, :] * 0.0046
        body.add("chest", "blush", grid.reshape(-1, 3), grid_faces(len(path), 6) + [tuple(np.arange(6)[::-1]), tuple(np.arange(6) + 6 * (len(path) - 1))], colors=np.tile(COLLAR_WHITE, (6 * len(path), 1)))
        tube(body, "chest", "gold", path + s * (width + 0.0012) + u * 0.0015, 0.0044, sides=5, normal=outward)


def build_obi(body):
    z = np.array([0.296, 0.32, 0.345, 0.37, 0.394])
    rx = np.array([0.136, 0.142, 0.144, 0.142, 0.134])
    ry = np.array([0.114, 0.118, 0.12, 0.118, 0.111])
    colors = np.repeat(mix(OBI_LOW, OBI_TOP, smooth(0.296, 0.394, z))[:, None, :], 26, axis=1)
    verts, faces = capped(ring_grid(z, rx, ry, 26))
    body.add("spine", "kimono", verts, faces, colors=colors.reshape(-1, 3))
    for k in (0, -1):
        a = np.linspace(0, 2 * math.pi, 26, endpoint=False)
        loop = np.stack([(rx[k] + 0.001) * spow(np.cos(a), 2 / 2.4), (ry[k] + 0.001) * spow(np.sin(a), 2 / 2.4), np.full(26, z[k])], axis=1)
        tube(body, "spine", "gold", loop, 0.0075, sides=4, closed=True, normal=lambda p: unit(p * [1, 1, 0]))
    knot = np.array([0.0, -0.128, 0.345])
    flower(body, "spine", knot, (0, -1, 0.06), 0.034, petal="gold", middle="amber")
    # Two pink ribbon tails falling over the skirt from under the knot, with gold points.
    for sx in (-1, 1):
        pts = np.array([(sx * 0.012, -0.132, 0.325), (sx * 0.03, -0.158, 0.285), (sx * 0.046, -0.176, 0.235), (sx * 0.052, -0.196, 0.19)])
        path = spline(pts, 7)
        s, u = frames(path, (0, -1, 0.1))
        a = np.linspace(0, 2 * math.pi, 6, endpoint=False)
        w = np.interp(np.linspace(0, 1, 8), [0, 0.2, 1], [0.012, 0.02, 0.022])[:, None, None]
        grid = path[:, None, :] + w * np.cos(a)[None, :, None] * s[:, None, :] + 0.0045 * np.sin(a)[None, :, None] * u[:, None, :]
        body.add("spine", "rose", *capped(grid))
        tip = path[-1]
        d = unit(path[-1] - path[-2])
        points = np.array([tip - d * 0.004, tip + d * 0.014, tip + d * 0.03])
        lock(body, "spine", points, 0.044, thick=0.3, rows=4, sides=5, normal=(0, -1, 0.1), start=1.0, tip=1.2, role="gold", soft_end=False, palette=lambda t: np.tile(srgb("#FFD45C"), (len(t), 1)))


def pleats(a, count, amp):
    """Soft-edged pleats around an angle: a rounded triangle wave."""
    return amp * (2 / math.pi) * np.arcsin(np.clip(0.94 * np.cos(a * count), -1, 1))


def skirt_ring(z, r0, r1, z0, z1, a, count, amp):
    t = (z0 - z) / (z0 - z1)
    r = r0 + (r1 - r0) * t ** 0.9
    k = 1 + pleats(a, count, amp) * (0.25 + 0.75 * t)
    return np.stack([r * k * np.sin(a), r * k * np.cos(a) * 0.94, np.full_like(a, z)], axis=-1)


def build_skirt(body):
    # Angles here run from the front: a is measured from -y through +x.
    def world(p):
        out = p.copy()
        out[..., 1] = -p[..., 1]
        return out

    # The long under-skirt.
    z0, z1 = 0.34, 0.165
    r0, r1 = 0.126, 0.236
    a = np.linspace(0, 2 * math.pi, 60, endpoint=False)
    zs = np.linspace(z0, z1, 5)
    grid = np.stack([skirt_ring(z, r0, r1, z0, z1, a, 15, 0.05) for z in zs])
    grid = world(grid)
    body.add("skirt", "underSkirt", grid.reshape(-1, 3), grid_faces(5, 60), ref=(0, 0, 0.3))
    tube(body, "skirt", "gold", grid[-1] + [0, 0, 0.001], 0.0088, sides=5, closed=True, normal=lambda p: unit(p * [1, 1, 0]), step=2)
    # The rose over-skirt, open at the front.
    gap = 0.46
    o0, o1 = 0.345, 0.215
    or0, or1 = 0.13, 0.226
    a2 = np.linspace(gap, 2 * math.pi - gap, 52)
    zs2 = np.linspace(o0, o1, 5)
    grid2 = np.stack([skirt_ring(z, or0, or1, o0, o1, a2, 15, 0.042) for z in zs2])
    # The hem climbs a little towards the opening.
    climb = 0.03 * smooth(1.1, gap, np.minimum(a2, 2 * math.pi - a2))
    grid2[..., 2] += (np.linspace(0, 1, 5)[:, None] ** 1.5) * climb
    grid2 = world(grid2)
    colors = np.repeat(robe(np.linspace(0.45, 1.0, 5))[:, None, :], 52, axis=1)
    body.add("skirt", "roseSkirt", grid2.reshape(-1, 3), grid_faces(5, 52, closed=False), colors=colors.reshape(-1, 3), ref=(0, 0, 0.3))
    tube(body, "skirt", "gold", grid2[-1] + [0, 0, 0.001], 0.0074, sides=5, normal=lambda p: unit(p * [1, 1, 0]), step=2)
    for col in (0, -1):
        tube(body, "skirt", "gold", spline(grid2[:, col], 6), 0.0058, sides=5, normal=lambda p: unit(p * [1, 1, 0]))
    # The emblem on the front of the under-skirt.
    ez = 0.212
    et = (z0 - ez) / (z0 - z1)
    er = (r0 + (r1 - r0) * et**0.9) * 0.94 + 0.0115
    tilt = np.array([[1, 0, 0], [0, math.cos(0.5), -math.sin(0.5)], [0, math.sin(0.5), math.cos(0.5)]])
    gem_points = np.array([(1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1), (0, -1, 0), (0, 1, 0)], dtype=float)
    faces = [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]
    body.add("skirt", "emblem", (gem_points * (0.027, 0.009, 0.039)) @ tilt.T + [0, -er, ez], faces, shade=False)
    body.add("skirt", "amber", (gem_points * (0.0135, 0.008, 0.019)) @ tilt.T + [0, -er - 0.007, ez], faces, shade=False)


def limb(body, bone, role, a, b, ra, rb, sides=12, rows=5, flat=1.0, front=(0, -1, 0)):
    """A tapered limb from a to b with rounded ends, so it overlaps its neighbour when the joint turns."""
    a, b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    d = b - a
    length = np.linalg.norm(d)
    t = np.concatenate([[0.0, 0.03, 0.1], np.linspace(0.2, 0.8, rows), [0.9, 0.97, 1.0]])
    r = (ra + (rb - ra) * t) * np.sqrt(np.clip(1 - np.maximum(0.1 - t, 0) ** 2 / 0.01 * 0.97, 0, 1)) * np.sqrt(np.clip(1 - np.maximum(t - 0.9, 0) ** 2 / 0.01 * 0.97, 0, 1))
    R = basis(d, front)
    A = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    ring = np.stack([np.cos(A), np.sin(A) * flat, np.zeros(sides)], axis=1) @ R.T
    grid = (a + np.outer(t, d))[:, None, :] + r[:, None, None] * ring[None, :, :]
    body.add(bone, role, *capped(grid))


def build_legs(body, B):
    for side, sx in (("L", 1), ("R", -1)):
        hip = B[f"thigh{side}"][0]
        knee = B[f"shin{side}"][0]
        ankle = B[f"foot{side}"][0]
        limb(body, f"thigh{side}", "lilac", hip + [0, 0, 0.022], knee + [0, 0, -0.012], 0.051, 0.046)
        limb(body, f"shin{side}", "lilac", knee + [0, 0, 0.014], ankle + [0, 0, 0.0], 0.046, 0.04)
        # Boot: shaft, a foot running forward, a sole and a thick amber cuff.
        shaft = ring_grid([0.02, 0.05, 0.07, 0.09], np.array([0.05, 0.05, 0.051, 0.053]), np.array([0.05, 0.05, 0.051, 0.053]), 14, e=2.0)
        shaft[..., 0] += ankle[0]
        body.add(f"foot{side}", "boot", *capped(shaft))
        ys = np.array([0.054, 0.05, 0.02, -0.03, -0.07, -0.098, -0.112])
        widths = np.array([0.03, 0.05, 0.055, 0.056, 0.055, 0.042, 0.02])
        tops = np.array([0.03, 0.058, 0.066, 0.058, 0.048, 0.04, 0.026])
        bots = np.full(7, 0.009)
        a = np.linspace(0, 2 * math.pi, 12, endpoint=False)
        cz, sz = spow(np.cos(a), 2 / 2.6), spow(np.sin(a), 2 / 2.6)
        grid = np.zeros((7, 12, 3))
        for i in range(7):
            mid, half = (tops[i] + bots[i]) / 2, (tops[i] - bots[i]) / 2
            grid[i, :, 0] = ankle[0] + widths[i] * cz
            grid[i, :, 1] = ys[i]
            grid[i, :, 2] = mid + half * sz
        body.add(f"foot{side}", "boot", *capped(grid))
        sole = np.zeros((7, 12, 3))
        for i in range(7):
            sole[i, :, 0] = ankle[0] + (widths[i] + 0.003) * cz
            sole[i, :, 1] = ys[i] - (0.003 if i == 6 else 0)
            sole[i, :, 2] = 0.0075 + 0.0075 * sz
        body.add(f"foot{side}", "sole", *capped(sole))
        a2 = np.linspace(0, 2 * math.pi, 16, endpoint=False)
        cuff = np.stack([ankle[0] + 0.0555 * np.cos(a2), 0.0555 * np.sin(a2), np.full(16, 0.088)], axis=1)
        tube(body, f"foot{side}", "gold", cuff, 0.0125, sides=6, closed=True, normal=lambda p: unit((p - [ankle[0], 0, 0.088])))


def build_sleeve(body, B, arm, fore, sx):
    """A soft, drapey furisode bell hanging from the upper arm. It follows the arm to the elbow and on along the rest pose of
    the forearm, open at the cuff with a rolled lip and the rose lining inside. Pink at the top fading to purple at the hem,
    with a gold stripe near the hem."""
    P, Ra = B[arm]
    E, Rf = B[fore]
    d = unit(E - P)
    f = -Rf[:, 2]
    # The centre line: from inside the shoulder, out past the elbow, along the forearm.
    out = np.array([sx, 0, 0.0])
    ctrl = [P - d * 0.02, P + d * 0.055 + out * 0.016, E + out * 0.036 - f * 0.012, E + f * 0.045 + out * 0.03, E + f * 0.085 + out * 0.02]
    rows, cols = 13, 28
    path = spline(ctrl, rows - 1)
    tang = unit(np.gradient(path, axis=0))
    down = np.array([0, 0, -1.0])
    hang = unit(down - (tang @ down)[:, None] * tang)
    side = unit(np.cross(tang, hang))
    t = np.linspace(0, 1, rows)
    r_up = 0.06 + 0.026 * smooth(0.0, 0.6, t)
    r_side = 0.06 + 0.074 * smooth(0.0, 0.85, t)
    r_hang = 0.06 + 0.105 * smooth(0.05, 1.0, t)
    a = np.linspace(0, 2 * math.pi, cols, endpoint=False)
    cos_a, sin_a = np.cos(a), np.sin(a)
    # Soft folds that grow towards the hem, and a hem that trails back on the hanging side.
    folds = 1 + 0.04 * np.cos(6 * a + 0.6)[None, :] * smooth(0.35, 1.0, t)[:, None]
    trail = -tang[:, None, :] * (0.045 * smooth(0.45, 1.0, t)[:, None, None] * np.maximum(cos_a, 0)[None, :, None] ** 1.5)

    def rings(scale=1.0):
        hangpart = np.where(cos_a > 0, r_hang[:, None], r_up[:, None]) * cos_a[None, :]
        radial = hang[:, None, :] * hangpart[:, :, None] + side[:, None, :] * (r_side[:, None] * sin_a[None, :])[:, :, None]
        return path[:, None, :] + scale * radial * folds[:, :, None] + trail

    outer = rings()
    hem = outer[-1]
    center = hem.mean(axis=0)
    # The hem rolls over into the lining, which gives the cloth a soft thickness.
    lip_out = hem - (hem - center) * 0.03 + tang[-1] * 0.009
    lip_in = hem - (hem - center) * 0.085 + tang[-1] * 0.006
    surface = np.concatenate([outer, lip_out[None], lip_in[None]])
    fade = np.clip(t[:, None] * 0.82 + 0.3 * t[:, None] * np.maximum(cos_a, 0)[None, :], 0, 1)
    colors = np.concatenate([robe(fade), np.tile(ROBE_HEM, (2, cols, 1))]).reshape(-1, 3)
    body.add(arm, "sleeve", surface.reshape(-1, 3), grid_faces(rows + 2, cols) + [tuple(np.arange(cols)[::-1])], colors=colors, ref=(P + E) / 2)
    # The lining, from the lip back past the elbow, with a closed end.
    lining = np.concatenate([rings(scale=0.9)[rows // 2 + 1 : -1], lip_in[None]])
    r2 = len(lining)
    ids = np.arange(r2 * cols).reshape(r2, cols)
    body.add(arm, "lining", lining.reshape(-1, 3), grid_faces(r2, cols) + [tuple(ids[0])], ref=path[-2] + tang[-2] * 0.5)
    # The gold stripe near the hem.
    ring = outer[-3]
    stripe = ring + (ring - ring.mean(axis=0)) * 0.014
    tube(body, arm, "gold", stripe, 0.0072, sides=5, closed=True, normal=lambda p: unit(p - stripe.mean(axis=0)), flat=0.65)
    # The round of the shoulder, which keeps the joint covered as the arm turns.
    v, f = ellipsoid(P, (0.066, 0.066, 0.066), rows=8, cols=12)
    body.add(arm, "sleeve", v, f, colors=np.tile(ROBE_TOP, (len(v), 1)))


def build_forearm_and_hand(body, B, fore, hand, sx):
    E, Rf = B[fore]
    H, Rh = B[hand]
    limb(body, fore, "blush", E - (H - E) * 0.14, H + (H - E) * 0.02, 0.034, 0.039, sides=10, front=Rf @ np.array([0, -1.0, 0]))
    wrist = E + (H - E) * 0.86
    axis = unit(H - E)
    R = basis(axis, Rf @ np.array([0, -1.0, 0]))
    a = np.linspace(0, 2 * math.pi, 12, endpoint=False)
    loop = wrist + 0.0405 * (np.outer(np.cos(a), R[:, 0]) + np.outer(np.sin(a), R[:, 1]))
    tube(body, fore, "gold", loop, 0.0075, sides=5, closed=True, normal=lambda p: unit(p - wrist))

    # A mitten: a soft palm and a stub of a thumb, in the hand bone's space.
    def world(p):
        return p @ Rh.T + H

    palm = ellipsoid((0, -0.002, -0.016), (0.041, 0.035, 0.048), rows=8, cols=12)
    body.add(hand, "skin", world(palm[0]), palm[1])
    thumb = ellipsoid((-sx * 0.028, -0.026, -0.002), (0.0145, 0.0155, 0.021), rows=5, cols=7)
    body.add(hand, "skin", world(thumb[0]), thumb[1])


def fur_colors(t0, t1):
    """A lilac tint at the root of the tail, white along it, and the faintest blush at the tip. t is 0 to 1 over the whole tail."""

    def fn(t):
        tt = t0 + (t1 - t0) * np.asarray(t)
        c = mix(FUR_LILAC, FUR_WHITE, smooth(0.0, 0.3, tt))
        return mix(c, FUR_BLUSH, smooth(0.82, 1.0, tt))

    return fn


def build_tail(body, B):
    """Big fluffy tail in three pieces, split at the pivots: a smooth teardrop with a few large soft clumps. Each piece closes
    in a round end that overlaps the next."""
    T0, T1, T2 = B["tail0"][0], B["tail1"][0], B["tail2"][0]
    up2 = B["tail2"][1][:, 2]
    tip = T2 + up2 * 0.33
    spine = spline([T0 - unit(T1 - T0) * 0.03, T0, T1, T2, T2 + up2 * 0.16, tip], 120)
    length = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(spine, axis=0), axis=1))])
    total = length[-1]
    u_of = lambda p: length[np.argmin(np.linalg.norm(spine - p, axis=1))] / total
    joints = [u_of(T1), u_of(T2)]
    ranges = [("tail0", 0.0, joints[0] + 0.07), ("tail1", joints[0] - 0.08, joints[1] + 0.07), ("tail2", joints[1] - 0.08, 1.0)]

    def radius(t):
        return np.interp(t, [0.0, 0.1, 0.3, 0.5, 0.68, 0.82, 0.93, 1.0], [0.045, 0.07, 0.12, 0.146, 0.146, 0.116, 0.066, 0.008])

    for bone, a, b in ranges:
        rows, cols = 16, 20
        tt = np.linspace(a, b, rows)
        path = np.stack([np.interp(tt * total, length, spine[:, k]) for k in range(3)], axis=1)
        s, u = frames(path, (0.2, -0.3, 0.9))
        A = np.linspace(0, 2 * math.pi, cols, endpoint=False)
        ends = np.sqrt(np.clip(1 - (1 - smooth(a, a + 0.05, tt)) ** 2 * 0.96, 0, 1))
        if b < 0.99:
            ends = ends * np.sqrt(np.clip(1 - smooth(b - 0.05, b, tt) ** 2 * 0.96, 0, 1))
        # A few broad clumps that wrap slowly around the tail.
        phase = tt[:, None] * 3.4 + 0.2 * np.sin(3 * A)[None, :]
        tier = phase - np.floor(phase)
        clumps = 1 + 0.12 * (smooth(0.0, 0.72, tier) * smooth(1.0, 0.82, tier) - 0.45) + 0.05 * np.cos(3 * A[None, :] + tt[:, None] * 7) + 0.022 * np.cos(5 * A[None, :] - tt[:, None] * 5)
        r = (radius(tt) * ends)[:, None] * clumps
        grid = path[:, None, :] + r[:, :, None] * (np.cos(A)[None, :, None] * s[:, None, :] + np.sin(A)[None, :, None] * u[:, None, :])
        colors = np.repeat(fur_colors(a, b)(np.linspace(0, 1, rows))[:, None, :], cols, axis=1)
        # A faint lilac in the hollows between clumps.
        colors = colors + (FUR_LILAC - colors) * (0.3 * smooth(0.985, 0.93, clumps))[:, :, None]
        verts, faces = capped(grid)
        body.add(bone, "fur", verts, faces, colors=colors.reshape(-1, 3))


# ---- the build ----


def bone_frames():
    out = {}
    for name in BONES:
        m = np.array(bpy.data.objects[name].matrix_world)
        out[name] = (m[:3, 3].copy(), m[:3, :3].copy())
    return out


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=BLOCKOUT)
    bpy.context.view_layer.update()
    for obj in [o for o in bpy.data.objects if o.type == "MESH"]:
        bpy.data.objects.remove(obj)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(block):
            block.remove(item)
    missing = BONES - {o.name for o in bpy.data.objects}
    if missing:
        raise RuntimeError(f"bones missing from the blockout: {sorted(missing)}")

    materials = {role: make_material(role) for role in ROLES}
    B = bone_frames()
    body = Body()
    build_head(body, B)
    build_cap(body, B)
    build_fringe(body, B)
    build_crown(body, B)
    build_side_locks(body, B)
    build_strands(body, B)
    build_back_hair(body, B)
    build_ears(body, B)
    build_ornaments(body, B)
    build_torso(body)
    build_obi(body)
    build_skirt(body)
    build_legs(body, B)
    build_sleeve(body, B, "armL", "foreArmL", 1)
    build_sleeve(body, B, "armR", "foreArmR", -1)
    build_forearm_and_hand(body, B, "foreArmL", "handL", 1)
    build_forearm_and_hand(body, B, "foreArmR", "handR", -1)
    build_tail(body, B)
    tris = body.assemble(materials)
    bpy.context.view_layer.update()
    return tris


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", export_yup=True, export_apply=True, export_animations=False, export_skins=False)
    return os.path.getsize(GLB)


# ---- previews, rendered from the exported file ----


def mock_face(size=512):
    """Stand-in for the game's painted canvas at the same layout, so previews can judge the fringe against the eyes."""
    v, u = np.mgrid[0:size, 0:size] / (size - 1)
    x, z = (u - 0.5) * 0.44, v * 0.4
    img = np.ones((size, size, 4))
    skin = np.array([0xF8, 0xD6, 0xC0]) / 255
    img[..., :3] = skin
    for sx in (-1, 1):
        g = np.exp(-(((x - sx * 0.125) ** 2 + (z - 0.124) ** 2) / (2 * 0.028**2)))[..., None]
        img[..., :3] = img[..., :3] * (1 - 0.55 * g) + np.array([1.0, 0.43, 0.66]) * 0.55 * g
        ex, ez, rx, rz = sx * 0.086, 0.168, 0.033, 0.047
        inside = ((x - ex) / rx) ** 2 + ((z - ez) / rz) ** 2 < 1
        grad = np.clip((ez + rz * 0.1 - z) / (rz * 1.1), 0, 1)[..., None]
        eye = np.array([0x24, 0x1a, 0x38]) / 255 * (1 - grad) + np.array([0x7a, 0x55, 0xc2]) / 255 * grad
        img[..., :3] = np.where(inside[..., None], eye, img[..., :3])
        shine = ((x - ex + 0.28 * rx) / (0.36 * rx)) ** 2 + ((z - ez - 0.36 * rz) / (0.26 * rz)) ** 2 < 1
        dot = ((x - ex - 0.34 * rx) / (0.16 * rx)) ** 2 + ((z - ez + 0.34 * rz) / (0.16 * rx)) ** 2 < 1
        img[..., :3] = np.where((shine | dot)[..., None] & inside[..., None], 1.0, img[..., :3])
    mouth = (np.abs(z - (0.094 + (x / 0.013) ** 2 * 0.006)) < 0.0028) & (np.abs(x) < 0.013)
    img[..., :3] = np.where(mouth[..., None], np.array([0x7a, 0x30, 0x46]) / 255, img[..., :3])
    image = bpy.data.images.new("mock_face", size, size, alpha=False)
    image.pixels.foreach_set(img.astype(np.float32).ravel())
    return image


def dress_face(image):
    """Planar UVs on the imported face, the way the game projects it, with the stand-in painted on."""
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        slots = [i for i, s in enumerate(obj.material_slots) if s.material and s.material.name.startswith("face")]
        if not slots:
            continue
        mesh = obj.data
        uv = mesh.uv_layers.new(name="UVMap") if not mesh.uv_layers else mesh.uv_layers[0]
        for loop in mesh.loops:
            co = mesh.vertices[loop.vertex_index].co
            uv.data[loop.index].uv = (co.x / 0.44 + 0.5, co.z / 0.4)
        mat = obj.material_slots[slots[0]].material
        nt = mat.node_tree
        p = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image
        nt.links.new(tex.outputs["Color"], p.inputs["Base Color"])


def stage(background="#2e2458", size=800):
    scene = bpy.context.scene
    r = scene.render
    r.engine = "BLENDER_EEVEE"
    r.resolution_x = r.resolution_y = size
    r.image_settings.file_format = "PNG"
    r.film_transparent = False
    scene.eevee.taa_render_samples = 32
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    # Lit by a soft even room, seen against the compare page's plain backdrop.
    world = bpy.data.worlds.new("Room")
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    room = nt.nodes.new("ShaderNodeBackground")
    room.inputs[0].default_value = (0.86, 0.82, 0.92, 1)
    room.inputs[1].default_value = 0.62
    back = nt.nodes.new("ShaderNodeBackground")
    back.inputs[0].default_value = (*srgb(background), 1)
    choose = nt.nodes.new("ShaderNodeMixShader")
    path = nt.nodes.new("ShaderNodeLightPath")
    nt.links.new(path.outputs["Is Camera Ray"], choose.inputs[0])
    nt.links.new(room.outputs[0], choose.inputs[1])
    nt.links.new(back.outputs[0], choose.inputs[2])
    nt.links.new(choose.outputs[0], out.inputs[0])
    scene.world = world
    sun = bpy.data.objects.new("key", bpy.data.lights.new("key", "SUN"))
    sun.data.energy = 2.2
    sun.data.angle = math.radians(14)
    sun.rotation_euler = (Vector((2, -3, 4))).to_track_quat("Z", "Y").to_euler()
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    scene.collection.objects.link(cam)
    scene.camera = cam
    return scene, cam


def shoot(scene, cam, name, az, target, span, drop=4.0, folder=None):
    a, e = math.radians(az), math.radians(drop)
    t = Vector(target)
    cam.data.ortho_scale = span
    cam.location = t + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * 5
    cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
    path = os.path.join(folder or PREVIEWS, f"{name}.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def contact_sheet(paths, out, cols):
    tiles = []
    for p in paths:
        im = bpy.data.images.load(p)
        w, h = im.size
        px = np.empty(w * h * 4, dtype=np.float32)
        im.pixels.foreach_get(px)
        tiles.append(px.reshape(h, w, 4)[::2, ::2])
        bpy.data.images.remove(im)
    h, w = tiles[0].shape[:2]
    rows = math.ceil(len(tiles) / cols)
    sheet = np.zeros((rows * h, cols * w, 4), dtype=np.float32)
    for i, t in enumerate(tiles):
        r, c = i // cols, i % cols
        sheet[(rows - 1 - r) * h : (rows - r) * h, c * w : (c + 1) * w] = t
    im = bpy.data.images.new("sheet", cols * w, rows * h, alpha=False)
    im.pixels.foreach_set(sheet.ravel())
    im.filepath_raw = out
    im.file_format = "PNG"
    im.save()


def previews():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    bpy.context.view_layer.update()
    dress_face(mock_face())
    scene, cam = stage()
    os.makedirs(PREVIEWS, exist_ok=True)
    body = (0, 0.05, 0.63)
    head = (0, 0, 0.87)
    paths = [
        shoot(scene, cam, "front", 0, body, 1.5),
        shoot(scene, cam, "three_quarter", -38, body, 1.5),
        shoot(scene, cam, "side", -90, body, 1.5),
        shoot(scene, cam, "back", 180, body, 1.5),
        shoot(scene, cam, "head", -16, head, 0.82),
    ]
    paths += stress_pose(scene, cam)
    if SHEET:
        contact_sheet(paths, SHEET, 4)


def check_contract():
    """Reads the exported file back and compares it with the blockout. Anything off the contract stops the build."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=BLOCKOUT)
    bpy.context.view_layer.update()
    rest = {n: bpy.data.objects[n].matrix_world.copy() for n in BONES}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    bpy.context.view_layer.update()
    problems = []
    objects = bpy.data.objects
    missing = BONES - {o.name for o in objects}
    if missing:
        problems.append(f"missing bones {sorted(missing)}")
    drift = max(max(abs(a - b) for ra, rb in zip(rest[n], objects[n].matrix_world) for a, b in zip(ra, rb)) for n in BONES - missing)
    if drift > 1e-4:
        problems.append(f"bones moved by {drift}")
    meshes = [o for o in objects if o.type == "MESH"]
    orphans = [o.name for o in meshes if o.parent is None or o.parent.name not in BONES]
    if orphans:
        problems.append(f"meshes without a bone: {orphans}")
    if [o.name for o in meshes if o.parent.name == "prop"]:
        problems.append("meshes under prop")
    if bpy.data.images:
        problems.append("image textures in the GLB")
    pts = np.array([o.matrix_world @ v.co for o in meshes for v in o.data.vertices])
    tris = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    if not 12000 <= tris <= 25000:
        problems.append(f"{tris} triangles is outside the 12k to 25k budget")
    size = os.path.getsize(GLB)
    if size > 2_000_000:
        problems.append(f"GLB is {size} bytes")
    head = bpy.data.objects["head.body"]
    roles = {s.material.name for s in head.material_slots}
    if "face" not in roles:
        problems.append("no face material on the head")
    # The fringe must leave the painted eyes clear, in head-bone space.
    hair_slot = [i for i, s in enumerate(head.material_slots) if s.material.name == "hair"][0]
    used = {i for p in head.data.polygons if p.material_index == hair_slot for i in p.vertices}
    co = np.array([head.data.vertices[i].co for i in used])
    # Only hair in front of the skin counts: the cap dives under it around the face, out of sight.
    visible = co[:, 1] < surface_y(co[:, 0], co[:, 2], 0.0) - 0.001
    over_eyes = co[visible & (np.abs(co[:, 0]) > 0.053) & (np.abs(co[:, 0]) < 0.119) & (co[:, 2] > 0.1)]
    fringe_low = float(over_eyes[:, 2].min())
    if fringe_low < 0.21:
        problems.append(f"fringe reaches z {fringe_low:.3f} over the eyes")
    span = pts.max(axis=0) - pts.min(axis=0)
    no_tail = np.array([o.matrix_world @ v.co for o in meshes if not o.parent.name.startswith("tail") for v in o.data.vertices])
    print("LYRA triangles", tris, "meshes", len(meshes), "glb bytes", size)
    print("LYRA bone drift", round(drift, 7), "fringe lowest over the eyes", round(fringe_low, 3))
    print("LYRA bounds min", np.round(pts.min(axis=0), 3).tolist(), "max", np.round(pts.max(axis=0), 3).tolist())
    print("LYRA width without tail", round(float(no_tail[:, 0].max() - no_tail[:, 0].min()), 3), "x range", np.round([no_tail[:, 0].min(), no_tail[:, 0].max()], 3).tolist())
    print("LYRA materials", sorted(m.name for m in bpy.data.materials))
    if problems:
        print("LYRA CONTRACT PROBLEMS", problems)
        raise RuntimeError("; ".join(problems))
    print("LYRA contract ok")


def turn(name, axis, degrees):
    obj = bpy.data.objects[name]
    obj.matrix_basis = obj.matrix_basis @ Matrix.Rotation(math.radians(degrees), 4, axis)


def stress_pose(scene, cam):
    """Turns the joints about 40 degrees to show any gaps. Rigid parts must keep overlapping."""
    for name, axis, degrees in (
        ("armL", "X", -40), ("armR", "X", 40), ("armR", "Y", -25), ("foreArmL", "X", -40), ("foreArmR", "X", 35), ("thighL", "X", -40), ("shinL", "X", 40),
        ("thighR", "X", 35), ("shinR", "X", 25), ("footL", "X", 25), ("head", "Z", 25), ("head", "X", 12), ("earL", "Y", 30), ("earR", "X", 30),
        ("tail0", "Z", 25), ("tail1", "Z", 40), ("tail2", "Z", 40), ("hairBack", "X", 8),
    ):
        turn(name, axis, degrees)
    bpy.context.view_layer.update()
    return [shoot(scene, cam, "stress_front", -12, (0, 0.05, 0.6), 1.6), shoot(scene, cam, "stress_back", 150, (0, 0.05, 0.6), 1.6)]


def main():
    tris = build()
    export()
    print("LYRA per bone", dict(sorted(tris.items())))
    check_contract()
    previews()
    print("LYRA done")


try:
    main()
except Exception:
    import traceback

    traceback.print_exc()
    print("LYRA FAILED")
    sys.exit(1)
