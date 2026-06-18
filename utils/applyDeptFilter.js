const applyDeptFilter = (req, query = {}) => {
  if (req.admin && Number(req.admin.user_type) === 1) {
    return { ...query, dept_code: req.admin.dept_code };
  }

  return query;
};

export { applyDeptFilter };
