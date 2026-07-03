const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const applyDeptFilter = (req, query = {}) => {
  if (req.admin && Number(req.admin.user_type) === 1) {
    const deptCode = String(req.admin.dept_code || "").trim();

    // A department-level account without a department must never be able to
    // read all records. Return an impossible query instead.
    if (!deptCode) {
      return { ...query, _id: { $exists: false } };
    }

    return {
      ...query,
      dept_code: new RegExp(`^${escapeRegex(deptCode)}$`, "i")
    };
  }

  return query;
};

export { applyDeptFilter };
